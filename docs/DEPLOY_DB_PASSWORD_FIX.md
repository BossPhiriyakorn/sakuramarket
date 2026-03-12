# แก้ password authentication failed for user "postgres"

## สาเหตุ

ข้อความ **"password authentication failed for user \"postgres\""** หมายความว่า รหัสผ่านที่ใส่ใน `.env` (DB_PASSWORD) **ไม่ตรงกับรหัสที่ตั้งไว้ใน PostgreSQL** บนเซิร์ฟเวอร์ (หรือยังไม่ได้ตั้งรหัสให้ user `postgres`)

## วิธีแก้ (รันบน EC2)

### 1. ตั้งรหัส postgres ให้ตรงกับ .env

รหัสใน `.env` คือ `Boss112234` (หรือค่าที่คุณตั้งไว้) — ต้องไปตั้งใน PostgreSQL ให้ตรงกัน:

```bash
cd /home/ubuntu/Sakura
sudo bash scripts/server-set-postgres-password.sh 'Boss112234'
```

(ถ้า DB_PASSWORD ใน .env เป็นค่าอื่น ให้ใช้ค่านั้นแทน `Boss112234`)

### 2. รันสร้างตารางและแอดมินคนแรก

```bash
source ~/.nvm/nvm.sh   # ถ้าใช้ nvm
cd /home/ubuntu/Sakura
node scripts/run-db-setup.js
```

ถ้าสำเร็จ จะเห็นข้อความสร้างตารางและข้อมูลแอดมิน (admin@host.com / admin11223344)

### 3. (ถ้ายังเชื่อมต่อไม่ได้) ตรวจ pg_hba.conf

ถ้าตั้งรหัสแล้วยัง error อยู่ อาจเป็นว่า PostgreSQL ไม่อนุญาตให้ล็อกอินด้วยรหัสจาก 127.0.0.1:

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

สำหรับบรรทัดที่เกี่ยวกับ `127.0.0.1` หรือ `localhost` ใช้ `scram-sha-256` หรือ `md5` (ไม่ใช้ `peer`) แล้วบันทึกและรัน:

```bash
sudo systemctl reload postgresql
```

จากนั้นรัน `node scripts/run-db-setup.js` อีกครั้ง
