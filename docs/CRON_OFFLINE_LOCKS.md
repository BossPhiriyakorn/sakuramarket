# Cron — ปลดล็อคร้านที่เจ้าของไม่ออนไลน์เกิน 7 วัน

ร้านที่เจ้าของไม่ออนไลน์ติดต่อกันเกิน **7 วัน** (ตาม `user_presence.last_seen_at`) จะถูกปลดล็อคจองในแผนที่อัตโนมัติ — ข้อมูลร้านและลงทะเบียนร้านไม่ถูกลบ แค่ไม่มีที่บนแผนที่จนกว่าจะจองล็อคใหม่

---

## วิธีที่ 1: รันอัตโนมัติในตัวแอป (แนะนำเมื่อใช้ server.js)

เมื่อรันแอปด้วย **`npm run start`** หรือ **`npm run dev:all`** (custom server `server.js`) แอปจะ**รันงานปลดล็อคให้เอง** โดยไม่ต้องตั้ง cron ภายนอก:

- **รันครั้งแรก:** หลังสตาร์ท 1 นาที  
- **รันถัดไป:** ทุก 24 ชั่วโมง  

**ปิดการรันอัตโนมัติในตัว (ใช้ cron ภายนอกแทน):** ตั้งใน `.env`

```env
CRON_RELEASE_OFFLINE_ENABLED=false
```

**จำนวนวันออฟไลน์:** ใช้ค่าใน `.env` ชื่อ `OFFLINE_DAYS_RELEASE=7` (หรือส่ง query `?days=7` เมื่อเรียก API เอง)

---

## วิธีที่ 2: รันสคริปต์ด้วย cron ของ OS

ใช้เมื่อไม่รัน custom server หรือต้องการกำหนดเวลาเอง (เช่น ทุกวัน 02:00)

### Linux / macOS (crontab)

```bash
crontab -e
```

เพิ่มบรรทัด (แก้ `/path/to/Sakura` ให้ตรงกับโปรเจกต์):

```cron
# ทุกวันเวลา 02:00 — ปลดล็อคร้านที่เจ้าของออฟไลน์เกิน 7 วัน
0 2 * * * cd /path/to/Sakura && node scripts/release-offline-shop-locks.js
```

หรือใช้ npm script:

```cron
0 2 * * * cd /path/to/Sakura && npm run cron:release-offline-locks
```

**กำหนดจำนวนวัน (ไม่ใช้ 7):** ส่งอาร์กิวเมนต์ เช่น `node scripts/release-offline-shop-locks.js 14` สำหรับ 14 วัน

### Windows (Task Scheduler)

1. เปิด **Task Scheduler** → Create Basic Task  
2. Trigger: Daily, เวลา 02:00  
3. Action: Start a program  
   - Program: `node`  
   - Arguments: `scripts/release-offline-shop-locks.js`  
   - Start in: `C:\path\to\Sakura` ( path โปรเจกต์)

หรือใช้ batch file ที่ `cd` ไปที่โปรเจกต์แล้วรัน `node scripts/release-offline-shop-locks.js`

---

## วิธีที่ 3: เรียก API จาก cron / scheduler ภายนอก

เหมาะกับ Vercel Cron, cron บน hosting อื่น หรือบริการ scheduled job ที่เรียก HTTP ได้

**Endpoint:** `GET` หรือ `POST`  
`https://yourdomain.com/api/cron/release-offline-locks`

**ยืนยันตัวตน (ถ้าตั้ง CRON_SECRET ใน .env):** ส่ง header

```http
X-Cron-Secret: <ค่าที่ตั้งใน CRON_SECRET>
```

**กำหนดจำนวนวัน:** query string

```http
GET /api/cron/release-offline-locks?days=7
```

**ตัวอย่าง (curl):**

```bash
curl -X POST "https://yourdomain.com/api/cron/release-offline-locks?days=7" \
  -H "X-Cron-Secret: your-secret-from-env"
```

**Vercel Cron:** ใส่ใน `vercel.json` (และตั้ง `CRON_SECRET` ใน Environment Variables):

```json
{
  "crons": [{ "path": "/api/cron/release-offline-locks", "schedule": "0 2 * * *" }]
}
```

---

## วิธีที่ 4: PM2

ถ้าใช้ PM2 รันแอป (`pm2 start server.js`) สามารถให้ OS cron รันสคริปต์ตามวิธีที่ 2 ได้  
หรือสร้าง cron job ในระบบที่รัน `curl` ไปที่ `http://127.0.0.1:PORT/api/cron/release-offline-locks` (ใส่ port จริงและ `X-Cron-Secret` ถ้ามี)

---

## ตัวแปรสภาพแวดล้อมที่เกี่ยวข้อง

| ตัวแปร | ความหมาย |
|--------|----------|
| `OFFLINE_DAYS_RELEASE` | จำนวนวันที่ถือว่า "ออฟไลน์ติดต่อกัน" แล้วปลดล็อค (ค่าเริ่มต้น 7) |
| `CRON_SECRET` | ถ้ากำหนด การเรียก `/api/cron/release-offline-locks` ต้องส่ง header `X-Cron-Secret` ให้ตรงกับค่านี้ |
| `CRON_RELEASE_OFFLINE_ENABLED` | `false` = ปิดการรันอัตโนมัติในตัวจาก server.js (ใช้เมื่อตั้ง cron ภายนอก) |

---

## สรุป

- **ใช้ `server.js` (npm run start / dev:all):** งานปลดล็อครันอัตโนมัติในตัวทุก 24 ชม. ไม่ต้องตั้ง cron ถ้าไม่ปิดด้วย `CRON_RELEASE_OFFLINE_ENABLED=false`  
- **ไม่ใช้ server.js หรืออยากกำหนดเวลาเอง:** ตั้ง cron ตามวิธีที่ 2 หรือเรียก API ตามวิธีที่ 3/4
