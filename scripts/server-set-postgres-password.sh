#!/bin/bash
# ตั้งรหัสผ่านผู้ใช้ postgres ใน PostgreSQL ให้ตรงกับ .env (รันบน EC2 ครั้งเดียว)
# ใช้เมื่อ run-db-setup.js ขึ้น "password authentication failed for user \"postgres\""
#
# รัน: sudo bash scripts/server-set-postgres-password.sh 'รหัสจากไฟล์ .env (DB_PASSWORD)'
# ตัวอย่าง: sudo bash scripts/server-set-postgres-password.sh 'Boss112234'
# จากนั้นรัน: node scripts/run-db-setup.js

set -e
if [ -z "$1" ]; then
  echo "Usage: sudo bash scripts/server-set-postgres-password.sh 'your_db_password'"
  echo "  (ใช้รหัสเดียวกับ DB_PASSWORD ใน .env)"
  exit 1
fi

# หลีกเลี่ยง single quote ในรหัสทำให้ SQL พัง (แทนที่ ' ด้วย '' ใน SQL)
PASS="${1//\'/\'\'}"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$PASS';"
echo "ตั้งรหัส postgres เรียบร้อย แล้วรัน: node scripts/run-db-setup.js"
