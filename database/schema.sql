-- Run once in the Supabase SQL editor. Credentials stay on the Next.js server.
create table if not exists public.conversations (
  user_id text primary key,
  name text not null,
  read_at timestamptz not null default '-infinity'
);
create table if not exists public.messages (
  id text primary key,
  user_id text not null references public.conversations(user_id),
  text text not null,
  direction text not null check (direction in ('incoming', 'outgoing')),
  delivery text not null default 'sent' check (delivery in ('pending', 'sent')),
  created_at timestamptz not null default now(),
  received_at timestamptz not null default clock_timestamp()
);
create index if not exists messages_conversation_time on public.messages(user_id, created_at);
create table if not exists public.line_events (id text primary key);
-- Tombstones protect against an unsend arriving before a retried original message.
create table if not exists public.unsent_messages (id text primary key);
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.line_events enable row level security;
alter table public.unsent_messages enable row level security;

create or replace view public.conversation_summary with (security_invoker = true) as
select c.user_id, c.name,
  (select m.text from public.messages m where m.user_id = c.user_id and m.delivery = 'sent' order by m.created_at desc, m.id desc limit 1) as last_message,
  (select max(m.created_at) from public.messages m where m.user_id = c.user_id and m.delivery = 'sent') as updated_at,
  (select count(*)::integer from public.messages m where m.user_id = c.user_id and m.direction = 'incoming' and m.received_at > c.read_at) as unread
from public.conversations c;

create or replace function public.ingest_line_message(p_event_id text, p_message_id text, p_user_id text, p_name text, p_text text, p_created_at timestamptz)
returns void language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_message_id, 0));
  insert into line_events(id) values (p_event_id) on conflict do nothing;
  if not found then return; end if;
  insert into conversations(user_id, name) values(p_user_id, p_name)
    on conflict(user_id) do update set name = excluded.name;
  insert into messages(id, user_id, text, direction, created_at)
    values(p_message_id, p_user_id, case when exists(select 1 from unsent_messages where id = p_message_id) then '[Message unsent]' else p_text end, 'incoming', p_created_at)
    on conflict(id) do nothing;
end $$;

create or replace function public.unsend_message(p_message_id text)
returns void language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_message_id, 0));
  insert into unsent_messages(id) values(p_message_id) on conflict do nothing;
  update messages set text = '[Message unsent]' where id = p_message_id and direction = 'incoming';
end $$;

create or replace function public.reserve_outgoing(p_id text, p_user_id text, p_text text)
returns jsonb language plpgsql set search_path = public as $$
declare result messages;
begin
  insert into messages(id, user_id, text, direction, delivery) values(p_id, p_user_id, p_text, 'outgoing', 'pending') on conflict(id) do nothing;
  select * into result from messages where id = p_id;
  return to_jsonb(result);
end $$;

create or replace function public.mark_conversation_read(p_user_id text, p_cutoff timestamptz)
returns void language sql set search_path = public as $$
  update conversations set read_at = greatest(read_at, least(p_cutoff, clock_timestamp())) where user_id = p_user_id;
$$;
-- Service role only; never grant browser clients access to these records/functions.
revoke all on public.conversations, public.messages, public.line_events, public.unsent_messages, public.conversation_summary from anon, authenticated;
revoke execute on function public.ingest_line_message(text,text,text,text,text,timestamptz), public.unsend_message(text), public.reserve_outgoing(text,text,text), public.mark_conversation_read(text,timestamptz) from public, anon, authenticated;
grant all on public.conversations, public.messages, public.line_events, public.unsent_messages, public.conversation_summary to service_role;
grant execute on function public.ingest_line_message(text,text,text,text,text,timestamptz), public.unsend_message(text), public.reserve_outgoing(text,text,text), public.mark_conversation_read(text,timestamptz) to service_role;

-- Durable login limit shared by every serverless instance. Stores no raw IPs.
create table if not exists public.login_attempts (
  key text primary key,
  window_started_at timestamptz not null,
  attempts integer not null
);
alter table public.login_attempts enable row level security;
create or replace function public.consume_login_attempt(p_key text)
returns boolean language plpgsql set search_path = public as $$
declare attempt_count integer;
declare checked_at timestamptz := clock_timestamp();
begin
  if p_key !~ '^[a-f0-9]{64}$' or p_key is null then
    return false;
  end if;
  insert into login_attempts(key, window_started_at, attempts)
    values(p_key, checked_at, 1)
  on conflict(key) do update set
    attempts = case when login_attempts.window_started_at <= checked_at - interval '15 minutes'
      then 1 else least(login_attempts.attempts + 1, 6) end,
    window_started_at = case when login_attempts.window_started_at <= checked_at - interval '15 minutes'
      then checked_at else login_attempts.window_started_at end
  returning attempts into attempt_count;
  return attempt_count <= 5;
end $$;
revoke all on public.login_attempts from public, anon, authenticated;
revoke execute on function public.consume_login_attempt(text) from public, anon, authenticated;
grant all on public.login_attempts to service_role;
grant execute on function public.consume_login_attempt(text) to service_role;
