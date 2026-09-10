# Robolingo Webchat

เว็บแชทสำหรับแอดมิน LINE OA ทำด้วย Next.js + TypeScript และ CSS ธรรมดา ไม่มี UI library หรือ LINE SDK

## โจทย์ต้องทำอะไร

- ใช้ Next.js + TypeScript
- รับข้อความจากลูกค้าที่ทัก LINE OA
- แสดงชื่อและรหัสผู้ส่ง เลือกผู้สนทนาเพื่อตอบกลับได้
- ส่งข้อความจากเว็บกลับไปยังผู้ใช้ LINE ผ่าน OA
- เก็บโค้ดใน public GitHub repository และ host เว็บบน Vercel
- ส่ง URL ของ LINE OA, เว็บ และ GitHub

การตีความ: เว็บเป็นกล่องข้อความของแอดมิน ส่วนลูกค้าใช้แอป LINE คุยกับ OA หากผู้ประเมินหมายถึง widget ที่ลูกค้าพิมพ์บนเว็บ ควรยืนยันข้อนี้ก่อนส่งงาน

## เปิดโหมดทดลอง

ใช้ Node.js 22.18+ หรือ 24:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

เปิด http://127.0.0.1:3000 — ตัวอย่างตั้ง `DEMO_MODE=true` จึงไม่เรียก LINE หรือฐานข้อมูล ส่งข้อความทดลองและกด “จำลองข้อความเข้า” ได้ ข้อมูลอยู่ใน state ของเบราว์เซอร์ รีเฟรชแล้วเริ่มใหม่

## เชื่อม LINE จริง

1. เตรียม LINE OA และเปิด Messaging API เพื่อรับ Channel secret และ Channel access token
2. สร้าง Supabase project แล้วรัน `database/schema.sql` ใน SQL Editor (ใช้ฐานข้อมูลแยกสำหรับงานนี้)
3. กำหนด environment:

| ตัวแปร | ค่า |
| --- | --- |
| `DEMO_MODE` | `false` |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token |
| `LINE_CHANNEL_SECRET` | Channel secret |
| `LINE_CHANNEL_ID` | Channel ID สำหรับอ้างอิง (เก็บฝั่งเซิร์ฟเวอร์) |
| `SUPABASE_URL` | URL โปรเจกต์ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | legacy service_role key เฉพาะฝั่งเซิร์ฟเวอร์ |
| `ADMIN_PASSWORD` | รหัสผ่านแอดมินอย่างน้อย 12 ตัวอักษร |
| `SESSION_SECRET` | ค่าสุ่มอย่างน้อย 32 ตัวอักษร เช่น `openssl rand -hex 32` |
| `APP_URL` | origin ของเว็บที่ใช้งานจริง เช่น `https://your-app.vercel.app` |

4. ตั้ง webhook เป็น `https://your-app.vercel.app/api/line/webhook` ใน LINE Developers และเปิด Use webhook กับ webhook redelivery
5. กด Verify webhook ต้องสำเร็จ จากนั้นเพิ่มเพื่อน OA และส่งข้อความจาก LINE ส่วนตัว
6. เข้าหน้าเว็บด้วยรหัสผ่านแอดมิน เลือกผู้สนทนาและส่งข้อความกลับ ตรวจว่าปรากฏในแอป LINE จริง

`APP_URL` ต้องตรงกับ origin ที่เปิดเว็บทุกตัว รวมถึง localhost กับ 127.0.0.1 เลือกใช้อย่างเดียว การพัฒนาบนเครื่องต้องมี HTTPS tunnel เพื่อให้ LINE ส่ง webhook เข้าถึงได้

โหมด live ต้องตั้งค่าครบ หากไม่ครบจะแสดงหน้าตั้งค่าและปิด API ที่เกี่ยวข้อง ไม่สลับไปส่งข้อความทดลองเงียบ ๆ

## นำขึ้น GitHub / Vercel

1. สร้าง public GitHub repository แล้ว push โปรเจกต์นี้ ห้ามเพิ่ม `.env.local` หรือ secret ลง Git (มี `.gitignore` แล้ว)
2. Import repository ใน Vercel เลือก framework Next.js ใช้คำสั่ง build `npm run build`
3. เพิ่ม environment ฝั่ง Vercel ให้ครบ ตั้ง `DEMO_MODE=false` และ `APP_URL` ให้ตรงกับ production domain แล้ว deploy ใหม่
4. ระบบจำกัดการเข้าสู่ระบบ 5 ครั้งต่อ 15 นาทีต่อ IP ด้วยฐานข้อมูล (เก็บ hash แทน IP); เพิ่ม Vercel Firewall ได้หากต้องการป้องกันทราฟฟิกเพิ่มเติม
5. ตั้ง webhook ให้ตรงกับ production URL และทดสอบจาก LINE จริง

Vercel รองรับ Docker/OCI แล้ว แต่โปรเจกต์ Next.js นี้ deploy โดยตรงได้ ไม่จำเป็นต้องเพิ่ม Dockerfile; `docker-compose.yml` ยัง deploy ตรงบน Vercel ไม่ได้ และข้อมูลแชทยังต้องอยู่ในฐานข้อมูลภายนอก

## โครงสร้างโค้ด

- `app/page.tsx`, `app/layout.tsx` — หน้าหลักและ layout
- `components/webchat.tsx` — UI, ค้นหา, เลือกผู้ใช้, ข้อความร่าง, polling ทุก 4 วินาที
- `app/globals.css` — รูปแบบ desktop/mobile ไม่มี CSS framework
- `lib/chat.ts` — types, ตัวอย่างข้อมูล, ตัวกรอง/เรียงลำดับ
- `lib/security.ts` — ตรวจ LINE signature, session, input
- `lib/server.ts` — environment, session guard, Supabase REST
- `app/api/session` — login/logout
- `app/api/conversations` — รายชื่อและสถานะอ่าน
- `app/api/messages` — ประวัติและส่งข้อความ
- `app/api/line/webhook` — รับ LINE webhook
- `database/schema.sql` — ตาราง, RLS, atomic writes และ idempotency

ใช้ native fetch แทน SDK และ polling แทน WebSocket เพื่อลดส่วนที่ต้องดูแล

## ข้อจำกัดที่ควรรู้ก่อนส่งงาน

- รองรับข้อความข้อความล้วนในการแชทส่วนตัว (1:1) ข้อความรูป/สติกเกอร์แสดงชนิดข้อความ ไม่ได้ดาวน์โหลดไฟล์ กลุ่มไม่ได้อยู่ในขอบเขตนี้
- ชื่อผู้ใช้โหลดจาก LINE profile; ถ้าโหลดไม่ได้จะใช้ส่วนท้าย user ID แทน
- เว็บเก็บ incoming webhooks และ outgoing ที่ส่งผ่านเว็บนี้ ไม่รับปากการซิงก์ข้อความที่พิมพ์จาก LINE OA Manager เพราะ API สาธารณะไม่ได้ให้ outgoing webhook สำหรับกรณีนี้
- LINE API ยอมรับข้อความไม่ได้หมายความว่าปลายทางได้รับแล้ว เช่น ผู้ใช้บล็อก OA จึงไม่แสดงสถานะ “อ่านแล้ว/ได้รับแล้ว”
- แสดงสูงสุด 200 ผู้สนทนา และข้อความล่าสุด 500 รายการต่อคน ยังไม่มี pagination
- webhook ซ้ำไม่สร้างข้อความซ้ำ และ event ยกเลิกข้อความจะแทนข้อความด้วย `[Message unsent]`
- หากส่งแล้วเครือข่ายขาด ให้กดส่งข้อความเดิมอีกครั้งในหน้าเดิม ระบบเก็บ retry key ไว้เพื่อป้องกันส่งซ้ำ อย่ารีเฟรชจนทราบผล เพราะ key ฝั่งเบราว์เซอร์ไม่คงอยู่ข้ามการรีเฟรช หากรอนานเกิน 23 ชั่วโมงต้องตรวจผลเองก่อน
- เป็นแอดมินหนึ่งชุดรหัสผ่าน ยังไม่มีบัญชีผู้ใช้หลายคน, password reset, audit log ระบบกู้คืนบัญชี

## ตรวจสอบ

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Browser smoke test ใช้ Playwright ที่ติดตั้งไว้แล้ว โดยไม่เพิ่มเป็น dependency ของแอป:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.js node tests/browser-smoke.mjs
```

ครอบคลุมค้นหา, ข้อความร่างแยกผู้ใช้, ส่ง/รับข้อความทดลอง, แสดงข้อความเป็น text ปลอดภัย, mobile navigation และ overflow ที่ 320/390/768px

**สถานะการตรวจ:** lint, typecheck, 7 unit tests, build และ browser demo ผ่านแล้ว; schema ติดตั้งบน Supabase และ `database/verify.sql` ผ่านแล้ว (rollback ข้อมูลทดสอบ) ทดสอบ production LINE → เว็บ → LINE ผ่านแล้ว รวมทั้งตรวจ unauthenticated API และ webhook ลายเซ็นไม่ถูกต้องได้ 401

## ลิงก์ส่งงาน

- LINE OA: https://line.me/R/ti/p/@099nyaqc
- Vercel: https://robolingo-webchat-eight.vercel.app
- Public GitHub: https://github.com/wachiramet/robolingo-webchat

## เอกสารอ้างอิง

- [LINE: รับข้อความ](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)
- [LINE: ตรวจ webhook signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)
- [LINE: Push message](https://developers.line.biz/en/reference/messaging-api/#send-push-message)
- [Supabase REST API](https://supabase.com/docs/guides/api)
- [Vercel Docker support](https://vercel.com/kb/guide/does-vercel-support-docker-deployments)
- [Vercel Docker Compose](https://vercel.com/i/can-you-run-docker-compose-on-vercel)
