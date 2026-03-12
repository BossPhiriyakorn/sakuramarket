# CMS Sakura Market

หน้า CMS สำหรับแอดมิน จัดการข้อมูลตามฐานข้อมูล — เข้าได้ที่ **`/cms`** (ลิงค์ลงท้ายด้วย `/cms`)

---

## การเข้าใช้งาน

- URL: `http://localhost:3000/cms` (พัฒนา) หรือ `https://your-domain.com/cms` (production)
- ตัวอย่างคอมเมนต์ใน `.env`: ใส่ลิงค์ที่ลงท้ายด้วย `/cms` ตามที่ใช้

---

## สิ่งที่ CMS จัดการ (ตามฐานข้อมูล)

| เมนู | ตารางที่เกี่ยวข้อง | การจัดการ |
|------|-------------------|-----------|
| **Dashboard** | — | สรุปภาพรวม ลิงค์ไปแต่ละส่วน |
| **ผู้ใช้** | users, profiles | ดู/ค้นหารายชื่อผู้ใช้ โปรไฟล์ |
| **ร้านค้า** | shops, shop_registrations | จัดการร้านค้าของผู้ใช้ และการจองที่ (สถานะ: ยังไม่เช่าที่ / เช่าที่แล้ว / ติดต่อเช่าที่) |
| **เอกสารยืนยันตัวตน** | shop_verification_documents | ตรวจเอกสาร (approve/reject), review_notes |
| **ประกาศ (Live)** | announcements | สร้าง/แก้/ลบ ข้อความแถบ Live แยกตาม room_id |
| **คำสั่งซื้อ** | orders, order_items | ดูรายการคำสั่งซื้อ สถานะ |
| **ห้องและล็อค** | rooms, parcels | ดูห้อง/ล็อคบนแผนที่ จัดสรร parcels (ถ้าต้องการ) |

---

## ออกแบบ UI

- **สไตล์:** โมเดิร์น ธีมเดียวกับแอป (พื้นหลัง slate-950, สี pink accents, border-pink-900/30)
- **เมนู:** อยู่ซ้ายมือ (sidebar) คลิกแล้วเปลี่ยนหน้า
- **การเข้าใช้งาน:** CMS เข้าแยกจากแอป (ไม่มีลิงค์กลับไปแอป)

---

## ข้อมูล CMS และการเชื่อมกับ App

- **แหล่งข้อมูลร่วม:** `data/marketData.ts` — เก็บ Mock ตัวอย่าง (ห้อง 1 จำนวน 3 ร้าน, ห้อง 2 จำนวน 1 ร้าน) และ MOCK_USERS, MOCK_PROFILES, MOCK_SHOPS, MOCK_PARCELS, MOCK_ANNOUNCEMENTS ฯลฯ
- **ยูสทดสอบ (TEST_USER_ID = u5):** ลงทะเบียนร้านแล้ว แต่**ยังไม่ได้จองที่** — ใช้ทดสอบได้ดังนี้
  - **แอป (โปรไฟล์):** ไปที่ `/profile` แล้วกดปุ่ม **โหลดโปรไฟล์ทดสอบ** จะเติมข้อมูลยูส u5 (ชื่อ ทดสอบ จองที่, ร้านทดสอบจองที่) ในหน้าโปรไฟล์
  - **CMS (จองที่):** ไปที่ `/cms/shops` เลือกรายการ **ร้านทดสอบจองที่** (สถานะ "ยังไม่เช่าที่") แล้วเข้าไปจองที่ในตารางกริด
- **CMS** ใช้ผ่าน `app/cms/data/cmsData.ts` (re-export จาก marketData) — หน้า CMS ทุกหน้า import จาก `./data/cmsData` หรือ `../data/cmsData`
- **App (แผนที่)** ใช้ผ่าน `store.ts` — เรียก `getParcelsForRoom(room)` และ `getAnnouncementsForRoom(room)` จาก `data/marketData.ts` ดังนั้นแผนที่และแถบ Live แสดงร้าน/ประกาศชุดเดียวกับที่ CMS จัดการ
- ต่อเชื่อม API/DB จริง: แก้ที่ `data/marketData.ts` (หรือสลับไปใช้ API client) แล้วทั้ง CMS และ App จะได้ข้อมูลชุดเดียวกัน

---

## API ข้อมูล (รับ/ส่ง mock)

- **ฐาน API:** `app/api/data/` — ใช้ store ฝั่งเซิร์ฟเวอร์ (`lib/api/dataStore.ts`) ที่ seed จาก `marketData` และรองรับการแก้ไข (เช่น จองที่)
- **Client:** `lib/api/client.ts` — ฟังก์ชัน `fetchRooms`, `fetchParcels(roomId?)`, `fetchAnnouncements(roomId?)`, `fetchShopDetail(id)`, `bookParcel(body)` ฯลฯ
- **แผนที่ (แอป):** ใช้ API แล้ว — `setCurrentRoom` / `fetchParcels` ดึง parcels และ announcements จาก `/api/data/parcels?roomId=`, `/api/data/announcements?roomId=`
- **CMS รายละเอียดร้าน + จองที่:** โหลดจาก `GET /api/data/shops/[id]` บันทึกจองจาก `POST /api/data/book-parcel` (body: `registrationId`, `roomId`, `slots: [{grid_x, grid_y}]`)
- **Endpoint อื่น:** `GET /api/data/rooms`, `/users`, `/users/[id]`, `/shop-registrations`, `/shops`, `/orders`, `/verification-documents`, `/dashboard` (จำนวนสำหรับ Dashboard)

---

## โครงสร้างไฟล์

- `app/cms/layout.tsx` — layout เมนูซ้าย + พื้นที่เนื้อหา
- `app/cms/page.tsx` — Dashboard
- `app/cms/users/page.tsx` — ผู้ใช้
- `app/cms/shops/page.tsx` — ร้านค้า (รวมจัดการจองที่)
- `app/cms/shop-registrations/page.tsx` — redirect ไป /cms/shops
- `app/cms/verification/page.tsx` — เอกสารยืนยันตัวตน
- `app/cms/announcements/page.tsx` — ประกาศ Live
- `app/cms/orders/page.tsx` — คำสั่งซื้อ
- `app/cms/parcels/page.tsx` — ห้องและล็อค

ตอนนี้แต่ละหน้ายังเป็น placeholder — ต่อเชื่อม API/DB ได้ในขั้นตอนถัดไป

---

## แก้เมื่อเจอ Error (MODULE_NOT_FOUND, GET 500)

ถ้าเจอ `Cannot find module './331.js'` หรือ `./611.js` หรือ `GET / 500` แนะนำให้ **ลบแคช build แล้ว build ใหม่**:

1. **หยุด dev server** (Ctrl+C ในเทอร์มินัลที่รัน `npm run dev`)
2. **ลบโฟลเดอร์ `.next`** (ในโฟลเดอร์โปรเจกต์)
3. รัน `npm run build`
4. รัน `npm run dev` อีกครั้ง

สาเหตุมักมาจากแคช build (.next) เสียหรือไม่สมบูรณ์ ทำให้ chunk ที่อ้างอิงหายไป
