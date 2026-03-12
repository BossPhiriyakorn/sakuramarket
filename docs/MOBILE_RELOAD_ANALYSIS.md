# การวิเคราะห์ปัญหา: มือถือโหลดซ้ำ / รีหน้าแอปตลอด

## อาการ
- บนมือถือ (รวม LINE in-app browser): หน้าแอปโหลดซ้ำตลอด (GET / วนซ้ำ), กดอะไรไม่ได้, แผนที่แสดงผิด (ซีกหนึ่งเป็นบล็อกสี + ข้อความแจ้ง error)
- บน PC ใช้งานได้ปกติ

## สาเหตุที่วิเคราะห์ได้จากโค้ดและ network log

### 1. การนำทางซ้ำไป "/" ขณะอยู่หน้า "/" อยู่แล้ว
- **ที่มา:** เมนู "หน้าแรก" ใน `UnifiedHeader` ใช้ `<Link href="/">` เสมอ
- **ผลบนมือถือ:** เมื่อผู้ใช้อยู่หน้า "/" แล้ว (หรือมีเหตุให้ Next ทำ client navigation ไป "/" อีกครั้ง) การกดหรือ trigger ลิงก์ไป "/" จะทำให้ Next.js ทำการโหลด RSC ใหม่หรือ re-render หน้า "/" ซ้ำ → PIXI/แผนที่ remount → แผนที่หายหรือแสดงผิด และอาจเกิด loop ถ้ามี state/effect ที่ trigger การนำทางซ้ำ
- **แก้แล้ว:** เมื่อ `pathname === "/"` แล้ว รายการเมนู "หน้าแรก" แสดงเป็นปุ่มที่แค่ปิดเมนู ไม่ใช้ `Link` ไป "/" (ไม่ trigger navigation ซ้ำ)

### 2. PIXI v8 deprecation: `addChild` บน non-Container
- **ที่มา:** ใน `GridBackground.tsx` ใช้ `g.addChild(border)` โดย `g` เป็น `PIXI.Graphics`
- **ผล:** PixiJS v8 อนุญาตให้เฉพาะ `Container` มี children; การใส่ child ใน `Graphics` เป็น deprecated และอาจทำให้พฤติกรรมผิดปกติหรือ error บนบาง environment (โดยเฉพาะมือถือ)
- **แก้แล้ว:** ใส่ `border` (Graphics) ลงใน `container` โดยตรง แทนการใส่ลงใน `g` และทำ cleanup ลบ/ทำลาย `border` ใน useEffect cleanup

### 3. Cookie ไม่มี Secure บน HTTPS (มือถือไม่เก็บ cookie → redirect loop)
- **ที่มา:** เมื่อเข้าแอปผ่าน tunnel (trycloudflare) เป็น HTTPS แต่ `NODE_ENV=development` ทำให้ cookie ถูก set โดยไม่มี `Secure` flag
- **ผลบนมือถือ:** iOS Safari / LINE browser ไม่เก็บ cookie ที่ไม่มี Secure บน HTTPS → หลัง login cookie ไม่ติด → middleware เห็นว่าไม่มี cookie → redirect ไป /login → วนซ้ำ
- **แก้แล้ว:** `lib/auth.ts` ใช้ `isSecureConnection()` (ดูจาก `BASE_URL` ขึ้นต้นด้วย `https://`) เพื่อใส่ `Secure` ใน cookie และใน logout routes

### 4. การเรียก API ซ้ำบนหน้า "/" (มือถือโหลดผิด/โหลดซ้ำ)
- **ที่มา:** หลายจุดเรียก API เดียวกัน: useRequireAuth + UnifiedHeader เรียก `/api/auth/me`; GridMap + UIOverlay เรียก `/api/data/rooms`
- **ผลบนมือถือ:** ลำดับ/จำนวน request ต่างจากคอม, remount หรือสองเฟสเรนเดอร์ทำให้เรียกซ้ำ
- **แก้แล้ว:** หน้า "/" ไม่เรียก `/api/auth/me` ใน useRequireAuth (เชื่อ middleware); โหลด rooms ครั้งเดียวใน store (App เรียก fetchRooms), GridMap และ UIOverlay ใช้ store.rooms

### 5. การส่ง cookie กับทุก request (credentials: "include")
- **ที่มา:** บนมือถือ/LINE in-app browser การเรียก `fetch()` แบบ same-origin บางครั้งไม่ส่ง cookie ไปด้วยอัตโนมัติ
- **แก้แล้ว:** ใส่ `credentials: "include"` ในทุก request ที่ต้องใช้ auth: `lib/api/client.ts` (get/post/patch/del), store.fetchRooms, UIOverlay โพล, PresenceHeartbeat, BookLockModal, Sidebar, AnnouncementHistoryPanel, หน้า profile/tracking/register-shop

### 6. โหลด rooms ซ้ำใน BookLockModal
- **ที่มา:** เมื่อเปิดโมดัลจองล็อค (profile หรือ manage-shop) โมดัล fetch `/api/data/rooms` เอง แม้แอปแผนที่โหลด rooms ไว้ใน store แล้ว
- **แก้แล้ว:** BookLockModal ใช้ `store.rooms` เมื่อมีข้อมูลแล้ว (เช่น หลังจากผู้ใช้เคยเข้า "/") จะไม่ fetch rooms ซ้ำ; เฉพาะเมื่อ store ยังว่างจึง fetch

### 7. สิ่งที่แก้ไปก่อนหน้านี้ (ยังคงใช้อยู่)
- Login/Register ใช้ `window.location.href = "/"` แทน `router.push("/")` และไม่เรียก `router.refresh()` เพื่อไม่ให้ "/" remount ซ้ำหลังล็อกอิน
- `reactStrictMode: false` ใน `next.config.mjs` เพื่อลด double-mount ของ PIXI บนมือถือ
- หน้า "/" ไม่ redirect ฝั่ง client เมื่อ `/api/auth/me` คืน null (กัน redirect loop)
- `allowedDevOrigins` อ่านจาก `BASE_URL` สำหรับ tunnel (trycloudflare ฯลฯ)

### 8. หน้า "/" โหลดซ้ำบนมือถือ (บทบาท user) — GET / + API วนซ้ำ
- **สาเหตุ:** หน้า "/" ใช้ `useRequireAuth()` ที่ตั้ง `allowed=null` ก่อน แล้วค่อย `setAllowed(true)` ใน useEffect → สองเฟสเรนเดอร์ (โหลดตรวจสอบ → แสดงแผนที่) บนมือถือทำให้ต้นไม้ remount หรือ trigger การโหลดซ้ำ
- **แก้แล้ว:** หน้า "/" ไม่ใช้สองเฟส — ไม่มีสถานะ null สำหรับ auth (เชื่อ middleware ที่กัน role=user แล้ว), แสดงแผนที่เลย; และใน `NavigationLoadingOverlay` บล็อกทั้ง `click` และ `touchend` เมื่อลิงก์ไป "/" ขณะอยู่ที่ "/" แล้ว เพื่อกัน touch trigger navigation ซ้ำบนมือถือ

### 9. Cookie / JWT และการเก็บข้อมูลบนมือถือ
- **รูปแบบ cookie:** ใช้ `buildAuthCookieHeader()` ใน `lib/auth.ts` ให้รูปแบบ Set-Cookie เหมือนกันทุกที่ (login + refresh): `Path=/`, `HttpOnly`, `SameSite=lax`, `Secure` เมื่อใช้ HTTPS (จาก `BASE_URL` หรือ production)
- **Sliding session (ต่ออายุ JWT):** ใน `GET /api/auth/me` ถ้า token ยังใช้ได้แต่เหลืออายุน้อยกว่า 24 ชม. (หรือ 25% ของ JWT_EXPIRES_IN) จะออก cookie ใหม่ — มือถือเปิดแอปทิ้งไว้จะไม่หมดอายุกลางคัน
- **ส่ง cookie กับทุก request:** ใส่ `credentials: "include"` ใน login POST, followStore (loadFollows + toggle), และทุก fetch ที่ต้องใช้ auth (ดูรายการใน §5)
- **ไม่มี rewrite/redirect ใน next.config** ที่ทำให้ loop — config มีแค่ reactStrictMode, allowedDevOrigins

## API ที่โหลดตามลำดับบนหน้า "/" (หลังแก้)
ลำดับที่เห็นใน network (และแหล่งที่มาในโค้ด):
1. `GET /api/data/rooms` — **ครั้งเดียว** จาก store.fetchRooms (App mount)
2. `GET /api/auth/me` — **ครั้งเดียว** จาก UnifiedHeader (ชื่อผู้ใช้)
3. `GET /api/data/me/shop` — UnifiedHeader (ตรวจว่ามีร้านหรือไม่)
4. `GET /api/data/me/balance` — UnifiedHeader (fetchMyBalance)
5. `GET /api/data/parcels?roomId=1` + announcements — store.fetchParcels (จาก App mount)
6. `GET /api/data/me/follows` — Sidebar (followStore.loadFollows)
7. `GET /` — **ตัวนี้ถ้าวนซ้ำ = สาเหตุหลักของ “รีหน้าแอป”** (full page request หรือ client navigation ไป "/")
8. `POST /api/data/me/presence` — PresenceHeartbeat (layout)
9. `GET /api/data/announcements?roomId=1` — UIOverlay poll (ตามช่วงโพล)

## การโพลแบบ Real-time (ที่ "วน" GET announcements)

โปรเจกต์ออกแบบให้ทำงานแบบ real-time จึงมี **การโพลซ้ำเป็นช่วงเวลา** โดยตั้งใจ ไม่ใช่บั๊ก:

| แหล่ง | API | ความถี่ (คอม) | ความถี่ (มือถือ) |
|-------|-----|----------------|-------------------|
| **UIOverlay** | `GET /api/data/announcements?roomId=X` (แถบ Live) | ทุก **8 วินาที** | ทุก **15 วินาที** |
| **UIOverlay** | `GET /api/data/announcements?roomId=X&history=1` (ป๊อปอัปประกาศใหม่) | ทุก **4 วินาที** | ทุก **8 วินาที** |
| **PresenceHeartbeat** (layout ทุกหน้า) | `POST /api/data/me/presence` | ทุก **30 วินาที** | ทุก **30 วินาที** |

- ตัวที่ทำให้ log เห็น GET announcements วนๆ คือสองช่วงโพลใน **UIOverlay** (แถบ LIVE + ประวัติป้ายประกาศ)
- ถ้าต้องการลดความถี่ (ลดภาระมือถือ/จำนวน request ใน log) สามารถเพิ่มค่าช่วงโพลใน `components/UIOverlay.tsx` (เช่น `announcementsPollMs`, `historyPollMs`) ได้

## พื้นหลัง GIF ภาพเคลื่อนไหว

- **พื้นหลังเต็มจอ (หลังแอป):** ใช้ `BACKGROUND_IMAGE.MAIN` = **JPG** (`/backgrounds/Bg123.jpg`) ใน `App.tsx` — **ไม่ใช่ GIF** จึงไม่มีการ decode แอนิเมชันเต็มจอ
- **พื้นหลังตาราง (ห้อง 2):** ใช้ `ROOM_GRID_BACKGROUND[2]` = **GIF** (`/backgrounds/grid/SR3.gif`) ใน **WorldBackground.tsx** — โหลดผ่าน PIXI และเล่นเฟรมด้วย `PIXI.Ticker.shared` (animation loop)
- **ผลต่อมือถือ:** GIF ในตารางห้อง 2 ใช้ CPU ต่อเนื่องสำหรับเปลี่ยนเฟรม ถ้าเปิดห้อง 2 ทิ้งไว้บนมือถือจะกินแบตและอาจเสริมให้เครื่องหนักเมื่อรวมกับโพลประกาศ → ถ้าต้องการลดภาระบนมือถือ อาจพิจารณาปิดหรือลดความเร็วของ GIF ในห้อง 2 หรือใช้เป็นภาพนิ่งบนมือถือ

## แนะนำหลัง deploy
- ทดสอบบนมือถือจริง (Chrome/Safari และ LINE in-app browser) หลังแก้
- ถ้ายังโหลดซ้ำ: เปิด DevTools (Remote debugging) ดูว่า GET / เกิดหลังเหตุการณ์ใด (ก่อน/หลัง error ใน console, ก่อน/หลัง PIXI init ฯลฯ)
- ข้อความ "[ไม่สามารถเชื่อมต่อระบบ]" ในภาพอาจมาจาก overlay ของ Next.js หรือ extension ไม่พบในโค้ดแอปโดยตรง
