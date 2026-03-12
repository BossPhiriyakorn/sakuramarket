# คู่มือ Deploy Production (Sakura Market)

เอกสารนี้อ้างอิงการ Deploy บน **AWS EC2** ให้แอปและฟีเจอร์ Real-time (Socket.io) ทำงานบนโดเมนเดียว

---

## 1. ภาพรวม

| รายการ | รายละเอียด |
|--------|-------------|
| **เซิร์ฟเวอร์แนะนำ** | AWS EC2 (หรือ VPS อื่นที่รัน Node ได้) |
| **โครงสร้าง** | Custom Server (Next.js + Socket.io process เดียว) — ไฟล์ `server.js` |
| **โดเมน** | ใช้โดเมนเดียวสำหรับทั้งเว็บและ WebSocket (Real-time) |
| **ข้อจำกัด** | ไม่รองรับ Vercel / Serverless (ต้องรัน process ค้าง) |

---

## 2. ข้อกำหนดระบบ

- **Node.js** 18+ (แนะนำ LTS)
- **PostgreSQL** (รันบน EC2 หรือ RDS)
- **Nginx** — reverse proxy + SSL
- **PM2** — จัดการ process และ restart อัตโนมัติ
- **โดเมน** ชี้มาที่ Public IP ของ EC2

---

## 3. การตั้งค่า .env สำหรับ Production

คัดลอกจาก `.env.example` ไปเป็น `.env` บนเซิร์ฟเวอร์ แล้วแก้ค่าต่อไปนี้:

| ตัวแปร | ค่าใน Production |
|--------|-------------------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (หรือพอร์ตที่ Custom Server ฟัง) |
| `BASE_URL` | `https://yourdomain.com` |
| `DB_HOST` | host ของ PostgreSQL (localhost หรือ RDS endpoint) |
| `DB_PORT` | `5432` |
| `DB_NAME` | `sakuramarket` |
| `DB_USER` / `DB_PASSWORD` | ค่าจริง ไม่ใช้รหัสอ่อน |
| `SOCKET_URL` | `http://localhost:3000` (ถ้าใช้ Custom Server พอร์ตเดียว) |
| `NEXT_PUBLIC_SOCKET_URL` | `https://yourdomain.com` (โดเมนเดียวกับแอป) |
| `JWT_SECRET` | สร้างใหม่ด้วย `openssl rand -base64 32` |
| `JWT_EXPIRES_IN` | เช่น `7d` หรือ `24h` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ตั้งค่าแอดมินให้แข็งแรง |
| SMTP / OTP | ใส่ค่าจริงตาม [Brevo](https://www.brevo.com/) และนโยบาย OTP |

**หมายเหตุ:** โปรเจกต์ใช้ Custom Server (process เดียว) — `SOCKET_URL` กับแอปใช้พอร์ตเดียวกัน

---

## 4. ขั้นตอน Deploy บน EC2 (สรุป)

1. **เตรียม EC2**
   - สร้าง instance (Ubuntu 22.04 LTS แนะนำ)
   - เปิด Security Group: **80 (HTTP), 443 (HTTPS)**; ไม่ต้องเปิด 3000/3001 ออกอินเทอร์เน็ต
   - เชื่อม SSH เข้า instance

2. **ติดตั้งซอฟต์แวร์**
   - Node.js (nvm หรือ NodeSource), PostgreSQL (หรือเชื่อม RDS), Nginx, PM2
   - Clone repo หรืออัปโหลดโค้ด แล้วรัน `npm ci --production=false` และ `npm run build`

3. **ตั้งค่า .env**
   - สร้าง `.env` ตามหัวข้อ 3 และไม่ commit ไฟล์นี้

4. **รันแอป**
   - ตั้ง `NODE_ENV=production` ใน `.env` หรือใน environment ก่อนรัน (เช่น `export NODE_ENV=production` บน Linux)
   - รัน Custom Server: `npm run start` หรือ `node server.js` (หลัง `npm run build`) ผ่าน PM2

5. **ตั้ง Nginx**
   - Reverse proxy จาก 80/443 ไป `http://127.0.0.1:3000`
   - เปิด WebSocket สำหรับ Socket.io (ดูหัวข้อ 5)

6. **SSL**
   - ใช้ Let's Encrypt (Certbot) สำหรับ HTTPS

7. **ตรวจสอบ**
   - เปิด `https://yourdomain.com` และ CMS
   - ทดสอบ Real-time (เช่น สมัคร user ใหม่ แล้วดูหน้า CMS ผู้ใช้อัปเดตโดยไม่รีเฟรช)

---

## 5. ตัวอย่างการตั้งค่า Nginx

ใช้เมื่อแอปรันที่ `http://127.0.0.1:3000` (Custom Server พอร์ตเดียว):

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    # redirect ไป HTTPS หลังติด SSL
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

หลังติด SSL (Certbot) จะมีบล็อก `listen 443 ssl` — ใส่ `location /` แบบเดียวกัน และเพิ่ม `return 301` ที่ port 80 ไปที่ HTTPS

**สำคัญ:** การมี `Upgrade` และ `Connection "upgrade"` ทำให้ WebSocket (Socket.io) ทำงานผ่าน Nginx ได้

---

## 6. การตั้งค่า PM2

```bash
cd /path/to/project
pm2 start server.js --name sakura-app
pm2 save
pm2 startup
```

ใช้ `pm2 logs sakura-app` และ `pm2 restart sakura-app` ตามต้องการ

---

## 7. SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

ทำตามคำแนะนำของ Certbot เพื่อให้ Nginx ใช้ HTTPS อัตโนมัติ

---

## 8. Real-time (Socket.io) บน Production

- Next และ Socket.io ใช้ HTTP server ตัวเดียวกัน (`server.js`) จึงใช้โดเมนเดียวได้โดยไม่ต้องแยก path ใน Nginx
- ตรวจสอบว่า `.env` ตั้ง `NEXT_PUBLIC_SOCKET_URL` เป็น `https://yourdomain.com` (ไม่มี port) เพื่อให้ browser เชื่อม WebSocket ไปที่โดเมนเดียว

---

## 9. เอกสารที่เกี่ยวข้อง

| เอกสาร | ความหมาย |
|--------|-----------|
| [DB_SETUP.md](./DB_SETUP.md) | การตั้งค่า PostgreSQL และรัน db-init |
| [.env.example](../.env.example) | ตัวอย่างตัวแปรสภาพแวดล้อมทั้งหมด |
| [CMS.md](./CMS.md) | การใช้งานและเข้าใช้งาน CMS |

---

## 10. การจัดการและตรวจสอบ

- **Log:** `pm2 logs sakura-app`
- **Restart:** `pm2 restart sakura-app`
- **สถานะ:** `pm2 status`
- **ฐานข้อมูล:** ตรวจสอบการเชื่อมต่อและ migration ตาม [DB_SETUP.md](./DB_SETUP.md)
- **Real-time:** เปิด DevTools → Network → WS ดูการเชื่อมต่อ Socket.io ว่าสำเร็จหรือไม่
