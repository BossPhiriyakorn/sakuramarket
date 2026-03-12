# การตั้งค่าฐานข้อมูล (PostgreSQL)

## ปัญหา API คืน 500 (parcels, me/balance, item-shop-products, admins)

**สาเหตุ:** API เหล่านี้ดึงข้อมูลจาก PostgreSQL ผ่าน `lib/api/dbStore.ts` ถ้าเกิดข้อผิดพลาดด้านล่าง จะทำให้คืน 500:

1. **ไม่ได้รัน PostgreSQL** หรือเชื่อมต่อไม่ได้ (host/port/password ใน `.env` ผิด)
2. **ยังไม่ได้สร้างตาราง** — ต้องรันสคริปต์ init ก่อน จึงจะมีตาราง `rooms`, `parcels`, `user_balances`, `item_shop_products`, `admins`, `user_verification`, `promo_zones` ฯลฯ

หลังจากแก้ไขแล้ว เราให้ API คืนค่าปลอดภัย (เช่น `parcels: []`, `balance: 0`, `products: []`, `admins: []`) แทน 500 เมื่อ DB ผิดพลาด เพื่อให้แอปยังโหลดได้ แต่จะไม่มีข้อมูลจนกว่าจะตั้งค่า DB ถูกต้อง

---

## ทำไมฝั่งผู้ใช้ยังมี "ห้อง" อยู่

- **ห้อง** มาจากตาราง `rooms` ใน DB
- ใน `scripts/seed.sql` มีการ INSERT ห้องเดียว (ชื่อว่าง แก้ไขได้ในระบบ)
- เมื่อรัน `npm run db:init` จะสร้างตารางจาก `scripts/schema-full.sql` แล้วรัน `scripts/seed.sql` (แอดมินเพิ่มจากเมนู จัดการแอดมิน ใน CMS หรือรัน `node scripts/seed-first-admin.js`)
- API `/api/data/rooms` อ่านจากตาราง `rooms` → ถ้า DB พร้อมและมีข้อมูล จะได้รายการห้อง
- API `/api/data/announcements?roomId=1` (หรือ 2) อาจคืน 200 เพราะตาราง `announcements` มีใน schema หลักและ query ไม่พึ่งตารางเพิ่มเติมที่อาจยังไม่มี

ดังนั้น **ถ้าเคยรัน db-init แล้ว** ตาราง `rooms` และข้อมูล seed จะมีอยู่ จึงเห็น "มีห้อง" ได้ แม้ API อื่น (เช่น parcels ที่ต้อง join หลายตาราง) จะยัง error จนเราเปลี่ยนให้คืนค่าปลอดภัยแล้ว

---

## วิธีตั้งค่า DB ให้ใช้งานได้ครบ

1. ติดตั้งและรัน PostgreSQL
2. สร้างฐานข้อมูล (เช่นชื่อ `sakuramarket`)
3. ใส่ค่าใน `.env`:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
4. รันสร้างตารางและ seed:
   ```bash
   node scripts/db-init.js
   ```
5. รีสตาร์ท dev server (`npm run dev`)

หลังจากนั้น API ที่เคย 500 จะดึงข้อมูลจาก DB ได้ตามปกติ (และถ้า DB หลุดอีกครั้ง จะได้แค่ข้อมูลว่างแทน 500)
