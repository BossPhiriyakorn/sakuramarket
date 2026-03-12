# 📚 Tech Stack เปรียบเทียบ: ปัจจุบัน vs Web3

เอกสารการพัฒนา Web3 สำหรับ Sakura Market — Infinite 2D Marketplace

---

## 📑 สารบัญ

1. [ส่วนที่มีอยู่แล้ว](#-ส่วนที่มีอยู่แล้ว-ใช้ต่อได้เลย)
2. [ส่วนที่ต้องเพิ่ม (Web3)](#-ส่วนที่ต้องเพิ่ม-web3-integration)
3. [ฐานข้อมูล](#-ฐานข้อมูล)
4. [การ Deploy](#-การ-deploy)
5. [บริการภายนอกที่ต้องเชื่อม (Web3)](#-บริการภายนอกที่ต้องเชื่อม-web3)
6. [ตัวแปรสภาพแวดล้อม (Env)](#-ตัวแปรสภาพแวดล้อม-env)
7. [สรุปเปรียบเทียบ & Checklist](#-สรุปเปรียบเทียบ)

---

## 🟢 ส่วนที่มีอยู่แล้ว (ใช้ต่อได้เลย)

### 1. Next.js 15 + React 18

```text
// ✅ คุณมีอยู่แล้ว
// app/page.tsx, app/layout.tsx, App.tsx
```

**ใช้ทำอะไร:**

- Framework หลักสำหรับสร้าง web application
- Server-side rendering (SSR) & Static generation
- Routing system
- API routes
- App Router (app/)

**ต้องทำอะไร:**

- ✅ ไม่ต้องเปลี่ยน — ใช้ต่อได้เลย
- เพิ่มเฉพาะ Web3 integration ในหน้าที่ต้องการ (เช่น wrap providers ใน layout.tsx)

---

### 2. TypeScript 5.8

```text
// ✅ คุณมีอยู่แล้ว
// types.ts, constants.ts, types/manageShop.ts
```

**ใช้ทำอะไร:**

- Type safety สำหรับ code
- Autocomplete & IntelliSense
- Catch errors ก่อน runtime
- Interface definitions (Parcel, GridState, ManageProduct)

**ต้องทำอะไร:**

- ✅ ไม่ต้องเปลี่ยน
- เพิ่ม types สำหรับ Web3 (wallet address, blockchain data, contract types)

---

### 3. PixiJS 8

```text
// ✅ คุณมีอยู่แล้ว
// components/GridMap.tsx, components/ParcelLayer.tsx
// components/GridBackground.tsx, components/HoverLayer.tsx
```

**ใช้ทำอะไร:**

- Render 2D canvas (grid, parcels, map)
- High-performance graphics
- Interactive map (pan, zoom)
- Sprite & graphics rendering

**ต้องทำอะไร:**

- ✅ ไม่ต้องเปลี่ยน
- เพิ่ม visual effects สำหรับ NFT parcels (badge, glow) ถ้าต้องการ

---

### 4. Zustand

```text
// ✅ คุณมีอยู่แล้ว
// store.ts, store/manageShopStore.ts
```

**ใช้ทำอะไร:**

- Global state management
- เก็บ viewport, selected parcel, parcels list
- เก็บ shop info, products, categories
- Actions: fetchParcels, selectParcel, setViewport

**ต้องทำอะไร:**

- ✅ ใช้ต่อได้
- เพิ่ม store ใหม่สำหรับ Web3 (wallet, owned parcels, listings) — ไม่ต้องแก้ store เดิม

---

### 5. TailwindCSS

```text
// ✅ คุณมีอยู่แล้ว
// tailwind.config.ts, โครงสร้าง utility classes ใน components
```

**ใช้ทำอะไร:**

- Utility-first CSS
- Responsive design
- Styling UI (sidebar, header, modals)
- Theme colors (slate, pink)

**ต้องทำอะไร:**

- ✅ ไม่ต้องเปลี่ยน
- เพิ่ม custom colors สำหรับ Web3 (NFT gold, Polygon purple) ถ้าต้องการ

---

## 🔵 ส่วนที่ต้องเพิ่ม (Web3 Integration)

### 6. wagmi v2

```text
// 🆕 ต้องติดตั้ง
// npm install wagmi viem @tanstack/react-query
```

**ใช้ทำอะไร:**

- เชื่อมต่อ wallet (MetaMask, WalletConnect)
- อ่าน/เขียน Smart Contracts
- จัดการ transactions
- React hooks สำหรับ Web3 (useAccount, useReadContract, useWriteContract)

**ต้องทำอะไร:**

- สร้าง `lib/web3/config.ts` — กำหนด chains, connectors, transports
- แก้ไข `app/layout.tsx` — wrap ด้วย WagmiProvider, QueryClientProvider
- สร้าง hooks ใน `lib/web3/hooks/` — useParcelData, useBuyParcel ฯลฯ

---

### 7. RainbowKit

```text
// 🆕 ต้องติดตั้ง
// npm install @rainbow-me/rainbowkit
```

**ใช้ทำอะไร:**

- UI สำหรับ wallet connection
- รองรับหลาย wallets
- Modal สวย built-in
- แสดง address, balance, chain

**ต้องทำอะไร:**

- แก้ไข `app/layout.tsx` — wrap ด้วย RainbowKitProvider
- แก้ไข `components/UnifiedHeader.tsx` — เพิ่ม `<ConnectButton />` (หรือใช้ leftContent/right slot)

---

### 8. Smart Contracts (Solidity + Hardhat)

```text
// 🆕 ต้องสร้าง
// contracts/SakuraParcel.sol, contracts/SakuraMarketplace.sol
```

**ใช้ทำอะไร:**

- NFT สำหรับ parcels (ERC-721)
- Marketplace logic (list, buy, cancel)
- Ownership บน blockchain
- Fee & payment logic

**ต้องทำอะไร:**

- ติดตั้ง Hardhat: `npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox`
- สร้างโฟลเดอร์ `contracts/` และเขียน Solidity
- สร้าง `scripts/deploy.ts` — deploy ไป Mumbai/Polygon
- Copy ABIs ไป `lib/web3/abis/`

---

### 9. IPFS + Pinata

```text
// 🆕 ต้องติดตั้งและสมัคร
// npm install pinata-web3
```

**ใช้ทำอะไร:**

- เก็บ NFT metadata (JSON)
- เก็บรูปภาพ (logo, cover, products)
- Decentralized storage
- Permanent links (ipfs://...)

**ต้องทำอะไร:**

- สมัคร Pinata, ได้ JWT
- สร้าง `lib/ipfs/pinata.ts` — uploadImage, uploadJSON
- สร้าง `lib/ipfs/metadata.ts` — buildParcelMetadata
- เชื่อมกับ Manage Shop — upload ก่อน mint/update

---

### 10. Backend + Database (Optional)

```text
// 🆕 ต้องสร้าง (ถ้าต้องการ off-chain data)
// backend/ หรือ app/api/, prisma/schema.prisma
```

**ใช้ทำอะไร:**

- เก็บ metadata off-chain (ชื่อร้าน, รายละเอียด)
- Search & filtering
- Analytics
- Sync กับ blockchain events

**ต้องทำอะไร:**

- เลือกฐานข้อมูล: แนะนำ **PostgreSQL** (ดูรายละเอียดใน [ฐานข้อมูล](#-ฐานข้อมูล))
- ติดตั้ง Prisma, สร้าง schema (Shop, Product, Transaction)
- สร้าง API routes ใน `app/api/`
- สร้าง indexer สำหรับ blockchain events (optional)

---

## 📋 สรุปเปรียบเทียบ

| รายการ           | ปัจจุบัน | Web3 |
|------------------|----------|------|
| Framework        | Next.js 15 ✅ | ใช้ต่อได้ |
| Language         | TypeScript 5.8 ✅ | ใช้ต่อได้ |
| Canvas           | PixiJS 8 ✅ | ใช้ต่อได้ |
| State            | Zustand ✅ | ใช้ต่อได้ + Web3 store |
| Styling          | TailwindCSS ✅ | ใช้ต่อได้ |
| Wallet           | —        | wagmi + RainbowKit 🆕 |
| Contracts        | —        | Solidity + Hardhat 🆕 |
| Storage          | Local/Mock | IPFS + Pinata 🆕 |
| Backend          | —        | Optional (Prisma/API) 🆕 |

---

## 🗄️ ฐานข้อมูล

โปรเจคเป็น Full Stack (F + B + API ในตัว) แนะนำใช้ **PostgreSQL** กับ **Prisma** สำหรับข้อมูล off-chain (ร้าน, สินค้า, sync จาก chain)

**ใช้ทำอะไร:**

- เก็บ metadata ร้าน/สินค้า
- Search & filtering
- บันทึก transaction ที่ sync จาก blockchain (optional)
- Analytics

**ตัวเลือกโฮสต์ PostgreSQL:**

| ตัวเลือก | เหมาะกับ | Free tier |
|----------|----------|-----------|
| **Supabase** | ต้องการ DB + Auth + Storage ในที่เดียว | มี |
| **Neon** | ใช้กับ Next.js + Vercel, serverless DB | มี |
| **Railway** | ตั้งค่า DB เร็ว | มีเครดิต |
| **Vercel Postgres** (Neon) | อยู่ ecosystem Vercel | มี |

**ต้องทำอะไร:**

- เลือก provider ด้านบน → สร้างโปรเจค → ได้ `DATABASE_URL`
- ใส่ใน `.env`: `DATABASE_URL="postgresql://..."`
- ใช้ Prisma: `prisma/schema.prisma`, `npx prisma migrate dev`

---

## 🚀 การ Deploy

Web3 ยังต้อง **deploy ส่วนเว็บ (Frontend + Backend)** เพื่อให้มี URL ให้ผู้ใช้เข้า — Smart contracts อยู่บน chain แยกจาก hosting

**ส่วนที่ deploy:**

| ส่วน | อยู่ที่ | ต้อง deploy เองไหม |
|------|---------|----------------------|
| Smart contracts | Blockchain (Polygon) | Deploy ขึ้น chain (ครั้งเดียว) |
| Frontend + API | Hosting | ✅ ต้อง deploy |
| Database | บริการ managed (Supabase/Neon) | ไม่ต้องเช่า server |

**ตัวเลือกโฮสต์ (เว็บวิว + API):**

| วิธี | ความง่าย | รองรับ Next.js เต็ม | หมายเหตุ |
|------|----------|----------------------|----------|
| **Vercel** | ง่าย | ✅ | แนะนำ, มี free tier |
| **AWS Amplify** | ง่าย | ✅ | อยู่ ecosystem AWS |
| **Netlify** | ง่าย | ✅ | คล้าย Vercel |
| **AWS S3 + CloudFront** | ปานกลาง | ❌ static เท่านั้น | ต้อง export static |
| **AWS EC2** | ซับซ้อน | ✅ | ต้องดูแล server เอง |

**สรุป:** ใช้ **Vercel** หรือ **AWS Amplify** สำหรับ Next.js Full Stack ได้โดยไม่ต้องจัดการเซิร์ฟเวอร์เอง

---

## 🔌 บริการภายนอกที่ต้องเชื่อม (Web3)

เมื่อทำ Full Stack (F + B + API ในตัว) นอกจาก code แล้วต้อง **สมัคร/เชื่อม** บริการเหล่านี้:

### จำเป็น

| บริการ | ใช้ทำอะไร | สิ่งที่ได้ |
|--------|-----------|------------|
| **RPC Provider** (Alchemy / Infura / QuickNode) | ให้แอปอ่าน/เขียน blockchain | RPC URL |
| **WalletConnect Cloud** | ให้ปุ่ม Connect Wallet ทำงาน (หลาย wallet) | Project ID |
| **IPFS Pinning** (Pinata / NFT.Storage) | เก็บ metadata + รูป NFT | API Key / JWT |
| **Smart contracts** | Logic บน chain (เรา deploy เอง) | Contract addresses + ABIs |
| **Wallet + MATIC** | จ่าย gas ตอน deploy และทดสอบ | — |

### เลือกใช้ได้ (เสริม)

| บริการ | ใช้ทำอะไร |
|--------|-----------|
| **PolygonScan API** | ดู/verify transaction, ดึง tx ใน Backend |
| **Indexer** (Backend โพล์ event หรือ The Graph) | Sync event จาก chain ลง DB |
| **SIWE / NextAuth + Wallet** | Login ด้วย wallet ใน Backend |

**Checklist การเตรียม:**

- [ ] สมัคร RPC (Alchemy หรือ Infura) → ได้ RPC URL
- [ ] สมัคร WalletConnect Cloud → ได้ Project ID
- [ ] สมัคร Pinata (หรือ NFT.Storage) → ได้ JWT
- [ ] Deploy Smart contracts → ได้ contract addresses
- [ ] สร้าง wallet + เติม MATIC (testnet/mainnet)

---

## 🔐 ตัวแปรสภาพแวดล้อม (Env)

เก็บใน `.env.local` (ไม่ commit ขึ้น Git)

**Frontend (Next.js):**

```text
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # จาก WalletConnect Cloud
NEXT_PUBLIC_POLYGON_RPC=                 # จาก Alchemy/Infura (Polygon)
NEXT_PUBLIC_MUMBAI_RPC=                  # จาก Alchemy/Infura (Mumbai testnet)
NEXT_PUBLIC_PARCEL_CONTRACT_ADDRESS=     # หลัง deploy contract
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=
```

**Backend / Server-only:**

```text
DATABASE_URL=                             # จาก Supabase/Neon/Railway
PINATA_JWT=                               # จาก Pinata
PINATA_GATEWAY=                           # เช่น gateway.pinata.cloud
POLYGONSCAN_API_KEY=                      # ถ้าใช้ verify contract / ดึง tx
```

**Hardhat (แยกไฟล์ .env ที่ root):**

```text
MUMBAI_RPC=
POLYGON_RPC=
PRIVATE_KEY=                              # Wallet สำหรับ deploy (ไม่แชร์!)
POLYGONSCAN_API_KEY=
```

---

## ✅ Checklist การพัฒนา

- [ ] Phase 1: Design (wireframes, mockups, design system)
- [ ] Phase 2: ติดตั้ง wagmi, viem, RainbowKit
- [ ] Phase 3: เขียน Smart Contracts + tests + deploy testnet
- [ ] Phase 4: สร้าง lib/web3/config, hooks, ABIs
- [ ] Phase 5: เพิ่ม Connect Button, Transaction Modals
- [ ] Phase 6: IPFS upload + metadata
- [ ] Phase 7: Update ParcelLayer, Sidebar, My Parcels page
- [ ] Phase 8: Backend + Indexer (optional)
- [ ] Phase 9: Testing + Deploy mainnet

---

## 📌 สถานะเอกสาร

| ส่วน | สถานะ | หมายเหตุ |
|-----|--------|----------|
| Tech Stack เปรียบเทียบ | ✅ สมบูรณ์ | มีครบทั้งส่วนที่มีแล้ว + ส่วนที่ต้องเพิ่ม |
| ใช้ทำอะไร / ต้องทำอะไร | ✅ สมบูรณ์ | ทุกรายการมีครบ |
| ฐานข้อมูล | ✅ เพิ่มแล้ว | PostgreSQL + ตัวเลือกโฮสต์ (Supabase, Neon, Railway, Vercel Postgres) |
| การ Deploy | ✅ เพิ่มแล้ว | ต้อง deploy เว็บ, ตัวเลือก Vercel / AWS Amplify / Netlify / S3 / EC2 |
| บริการภายนอก Web3 | ✅ เพิ่มแล้ว | RPC, WalletConnect, IPFS, contracts + checklist |
| ตัวแปร Env | ✅ เพิ่มแล้ว | รายการ env สำหรับ Frontend, Backend, Hardhat |
| สรุปตาราง + Checklist | ✅ สมบูรณ์ | ระดับ Phase ครบ |
| รายละเอียด Phase Design | ⚠️ สรุป | ดูเอกสาร checklist แยกสำหรับ design รายข้อ |
| Timeline / Budget | ⚠️ ไม่มี | เพิ่มได้ถ้าต้องการ |

**สรุป:** เอกสารนี้ครอบคลุม **Tech Stack, ฐานข้อมูล, การ deploy, บริการที่ต้องเชื่อม และ env** สำหรับโปรเจค Sakura Market แบบ Full Stack + Web3

---

*เอกสารนี้เป็นส่วนหนึ่งของ Sakura Market Web3 Development Guide*
