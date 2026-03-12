# 🌸 Sakura Market - Infinite 2D Marketplace

Grid-based marketplace with infinite canvas powered by PixiJS

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy env and set values (see .env.example)
cp .env.example .env

# Run development server
npm run dev

# Open browser
http://localhost:3000
```

สำหรับ Real-time (Socket.io): ใช้ `npm run dev:all` — รายละเอียดและ Deploy Production ดูที่ [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

**Cron / ปลดล็อคร้านออฟไลน์:** เมื่อรันด้วย `npm run start` หรือ `npm run dev:all` แอปจะรันงานปลดล็อคร้านที่เจ้าของไม่ออนไลน์เกิน 7 วันให้อัตโนมัติทุก 24 ชม. ถ้าใช้ cron ภายนอกหรือ Vercel ดูที่ [docs/CRON_OFFLINE_LOCKS.md](docs/CRON_OFFLINE_LOCKS.md)

## 🎮 Controls

- **Pan:** Click and drag
- **Zoom:** Mouse wheel
- **Select:** Click on parcel

## 📁 Project Structure

```
Sakura/
├── components/          # React + PixiJS components
├── data/               # Types / helpers (data from API)
├── public/
│   ├── backgrounds/    # Background images
│   └── uploads/        # Uploaded images
├── services/           # API services
└── constants.ts        # Configuration
```

## 🛠️ Tech Stack

- **Vite** - Build tool
- **React 18** - UI framework
- **PixiJS 8** - Canvas rendering
- **Zustand** - State management
- **TypeScript** - Type safety
