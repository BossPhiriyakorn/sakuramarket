# การแยกแอดมินกับผู้ใช้ (Auth Separation)

แอปแยก **ผู้ใช้ (ลูกค้า)** กับ **แอดมิน (CMS)** อย่างชัดเจน ทั้งการล็อกอินและฐานข้อมูล

---

## 1. การล็อกอิน — คนละส่วนกัน

| | ผู้ใช้ (ลูกค้า) | แอดมิน (CMS) |
|---|----------------|----------------|
| **หน้า Login** | `/login` | `/admin/login` |
| **API** | `POST /api/auth/login` | `POST /api/auth/login-admin` |
| **หลังล็อกอินสำเร็จ** | ไปที่ `/` (หน้าตลาด) | ไปที่ `/cms` (แดชบอร์ด) |

- ล็อกอินผู้ใช้ **ไม่** ใช้ข้อมูลจากตาราง `admins`
- ล็อกอินแอดมิน **ไม่** ใช้ข้อมูลจากตาราง `users`

---

## 2. ฐานข้อมูล — เก็บแยกกัน

| ตาราง | ใช้กับ | หมายเหตุ |
|--------|--------|----------|
| **users** | ผู้ใช้ (ลูกค้า) | username, email, password_hash — ใช้กับ /login และการลงทะเบียน |
| **profiles** | ผู้ใช้ | ผูกกับ users(id) |
| **admins** | แอดมิน | email, password_hash, display_name — ใช้กับ /admin/login เท่านั้น |

- **ผู้ใช้:** ล็อกอิน/ลงทะเบียน ใช้เฉพาะ `users` (และ profiles)  
  รหัสผ่านเก็บใน `users.password_hash`
- **แอดมิน:** ล็อกอินใช้เฉพาะตาราง `admins` ในฐานข้อมูล  
  รหัสผ่านเก็บใน `admins.password_hash` (เพิ่ม/แก้แอดมินจากเมนู จัดการแอดมิน ใน CMS หรือสคริปต์ seed-first-admin.js)

ไม่มีตารางใดที่ใช้ร่วมกันสำหรับการยืนยันตัวตน (authentication) ระหว่างผู้ใช้กับแอดมิน

---

## 3. Token (JWT) — แยก cookie คนละตัว

- **ผู้ใช้:** cookie ชื่อ `sakura_token` — ใช้กับ `/`, `/login`, `/profile`, `/api/auth/me`, `/api/data/me/*`
  - Payload: `role: "user"`, `sub`: UUID ของ `users.id`
- **แอดมิน:** cookie ชื่อ `sakura_admin_token` — ใช้กับ `/cms`, `/admin/login`, และทุก API ฝั่งแอดมิน
  - Payload: `role: "admin"`, `sub`: `"admin"` (หรือ UUID ของแอดมินในอนาคต)
- แยกกันเพื่อไม่ให้แอดมินล็อกอินแล้วทับ session ผู้ใช้ (เวลาผู้ใช้รีเฟรชจะไม่โดนส่งไปหน้าแอดมิน)
- Middleware อ่าน cookie ตาม path: หน้า user อ่านเฉพาะ `sakura_token`, หน้า /cms อ่านเฉพาะ `sakura_admin_token`

---

## 4. Path ที่ต้องใช้

- **ผู้ใช้ (แอปลูกค้า):** ลิงค์ปกติ (โดเมนราก) = ทางเข้าแอปลูกค้าเสมอ
  - `/` → ถ้ายังไม่ล็อกอินไป `/login`, ถ้าแอดมินเปิดก็ไป `/login` (ไม่ไป `/cms`)
  - `/login`, `/register`, `/profile`, `/manage-shop`, ฯลฯ
- **แอดมิน (CMS):** ต้องเข้าเฉพาะผ่าน path ที่ขึ้นต้นด้วย `/cms` หรือ `/admin/login`
  - ลิงค์ปกติ (โดเมนราก) จะไม่นำไป CMS — แอดมินที่เปิดลิงค์ปกติจะเห็นหน้า login ลูกค้า แล้วไป `/admin/login` หรือ `/cms` เอง
  - `/admin/login`, `/cms`, `/cms/*` เท่านั้น

---

## 5. ไฟล์ที่เกี่ยวข้อง

- ล็อกอินผู้ใช้: `app/api/auth/login/route.ts` → อ่านเฉพาะ `users` (และ `getAuthPassword` จาก users)
- ล็อกอินแอดมิน: `app/api/auth/login-admin/route.ts` → อ่านเฉพาะ `.env` หรือ `admins`
- ลงทะเบียนผู้ใช้: `app/api/auth/register/route.ts` → เขียนเฉพาะ `users` + `profiles` ผ่าน `registerUser`
- Middleware: `middleware.ts` → ใช้ `role` จาก JWT แยกว่าเป็น user หรือ admin
