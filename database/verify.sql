-- Run after schema.sql in the SQL Editor. Every test row is rolled back.
begin;
do $$
declare
  v_user text := 'U00000000000000000000000000000001';
  v_key text := repeat('a', 64);
  v_count integer;
  v_result jsonb;
begin
  delete from login_attempts where key = v_key;
  for i in 1..5 loop
    if not consume_login_attempt(v_key) then raise exception 'Login allowed attempts failed'; end if;
  end loop;
  if consume_login_attempt(v_key) then raise exception 'Login limit failed'; end if;
  update login_attempts set window_started_at = now() - interval '16 minutes' where key = v_key;
  if not consume_login_attempt(v_key) then raise exception 'Login window reset failed'; end if;

  perform ingest_line_message('verify-event-1', 'verify-message-1', v_user, 'SQL verification', 'hello', now());
  perform ingest_line_message('verify-event-1', 'verify-message-1', v_user, 'SQL verification', 'hello', now());
  select count(*) into v_count from messages where id = 'verify-message-1';
  if v_count <> 1 then raise exception 'Webhook idempotency failed'; end if;
  perform unsend_message('verify-message-1');
  if (select text from messages where id = 'verify-message-1') <> '[Message unsent]' then raise exception 'Unsend failed'; end if;

  perform unsend_message('verify-message-2');
  perform ingest_line_message('verify-event-2', 'verify-message-2', v_user, 'SQL verification', 'must stay hidden', now());
  if (select text from messages where id = 'verify-message-2') <> '[Message unsent]' then raise exception 'Early unsend failed'; end if;

  v_result := reserve_outgoing('verify-outgoing-1', v_user, 'reply');
  if v_result->>'delivery' <> 'pending' then raise exception 'Outgoing reservation failed'; end if;
  perform reserve_outgoing('verify-outgoing-1', v_user, 'reply');
  select count(*) into v_count from messages where id = 'verify-outgoing-1';
  if v_count <> 1 then raise exception 'Outgoing idempotency failed'; end if;

  perform mark_conversation_read(v_user, clock_timestamp());
  if (select unread from conversation_summary where user_id = v_user) <> 0 then raise exception 'Read marker failed'; end if;
  if has_table_privilege('anon','public.messages','SELECT') or has_table_privilege('authenticated','public.messages','SELECT') then raise exception 'Private messages are exposed'; end if;
  if has_function_privilege('anon','public.consume_login_attempt(text)','EXECUTE') then raise exception 'Rate limiter RPC exposed'; end if;
  if exists(select 1 from pg_tables where schemaname = 'public' and tablename in ('conversations','messages','line_events','unsent_messages','login_attempts') and not rowsecurity) then raise exception 'RLS missing'; end if;
end $$;
rollback;
select 'PASS: login limits, idempotency, unsend, read markers, permissions, RLS; test rows rolled back' as verification;
