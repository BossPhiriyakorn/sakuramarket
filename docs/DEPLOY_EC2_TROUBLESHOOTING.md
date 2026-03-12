# แก้ปัญหา Deploy ไป EC2 (GitHub Actions)

## Connection reset by peer / kex_exchange_identification

ถ้า workflow ล้มที่ขั้น **Create deploy directory on EC2** ด้วยข้อความเช่น:

- `kex_exchange_identification: read: Connection reset by peer`
- `Connection reset by 18.x.x.x port 22`
- `Error: Process completed with exit code 255`

**สาเหตุ:** EC2 Security Group ไม่อนุญาตให้ SSH (port 22) จาก IP ของ GitHub Actions runner

**วิธีแก้:**

1. เปิด **AWS Console** → **EC2** → **Security Groups** → เลือก Security Group ที่ผูกกับ instance
2. แก้ **Inbound rules** → เพิ่ม rule:
   - **Type:** SSH  
   - **Port:** 22  
   - **Source:** `0.0.0.0/0` (อนุญาตจากทุก IP — ใช้ได้กับ deploy จาก GitHub Actions)

   หรือถ้าต้องการจำกัดเฉพาะ IP ของ GitHub:
   - ดู IP ranges ได้ที่ https://api.github.com/meta (ส่วน `actions`) แล้วเพิ่มแต่ละ range เป็น Source

3. Save แล้วลองกด **Run workflow** อีกครั้ง

---

## Broken pipe (ระหว่าง npm run build)

ถ้าล้มที่ขั้น **Install, build and restart** ระหว่าง "Creating an optimized production build" ด้วย `Broken pipe`:

- Workflow ได้เพิ่ม SSH keepalive และ timeout ไว้แล้ว
- ถ้ายังล้มอีก: ตรวจสอบว่า EC2 มี memory เพียงพอ (Next.js build ใช้ RAM ค่อนข้างมาก) หรือลองรัน build บน EC2 เองด้วย SSH แล้วดู error
