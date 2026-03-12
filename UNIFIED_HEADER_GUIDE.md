# คู่มือการใช้ UnifiedHeader Component

## สรุปการแก้ไข

ได้สร้าง `UnifiedHeader` component ที่รวมฟีเจอร์จาก `MapHeader` และ `UserPageHeader` เข้าด้วยกัน เพื่อให้เมนูบาร์สอดคล้องกันทุกหน้า

## โครงสร้างไฟล์

- **`components/UnifiedHeader.tsx`** - เฮดเดอร์เดียวที่ใช้ทุกหน้า (ไม่มี MapHeader / UserPageHeader แล้ว)

## วิธีใช้งาน

### สำหรับหน้าแรก (แผนที่)

```tsx
import { UnifiedHeader } from "@/components/UnifiedHeader";

<UnifiedHeader
  showBrand={true}              // แสดงโลโก้ SAKURAMARKET
  showUsername={true}           // แสดงชื่อผู้ใช้ในปุ่มเมนู
  showRoomSwitcher={true}       // แสดงฟีเจอร์เปลี่ยนห้อง
  currentRoom={currentRoom}
  setCurrentRoom={setCurrentRoom}
  roomOptions={roomOptions}
  roomNames={roomNames}
  onOpenShopList={handleOpenShopList}  // Callback สำหรับ "รายการร้านค้า"
/>
```

### สำหรับหน้าอื่นๆ

```tsx
import { UnifiedHeader } from "@/components/UnifiedHeader";

<UnifiedHeader
  showBackButton={true}         // แสดงปุ่มกลับ
  title="ชื่อหน้า"              // หัวข้อกลาง
/>
```

### Custom Left Content

```tsx
<UnifiedHeader
  leftContent={<CustomButton />}  // Custom content ด้านซ้าย
  title="ชื่อหน้า"
/>
```

## Props ทั้งหมด

| Prop | Type | Default | คำอธิบาย |
|------|------|---------|----------|
| `showBrand` | `boolean` | `false` | แสดงโลโก้ SAKURAMARKET ด้านซ้าย |
| `showBackButton` | `boolean` | `false` | แสดงปุ่มกลับ ด้านซ้าย |
| `leftContent` | `React.ReactNode` | `undefined` | Custom content ด้านซ้าย (override showBrand/showBackButton) |
| `title` | `React.ReactNode` | `undefined` | หัวข้อกลาง (สำหรับหน้าอื่นๆ) |
| `showRoomSwitcher` | `boolean` | `false` | แสดงฟีเจอร์เปลี่ยนห้องในเมนู |
| `currentRoom` | `RoomId` | `undefined` | ห้องปัจจุบัน |
| `setCurrentRoom` | `(room: RoomId) => void` | `undefined` | ฟังก์ชันเปลี่ยนห้อง |
| `roomOptions` | `readonly number[]` | `[]` | รายการห้องที่เลือกได้ |
| `roomNames` | `Record<number, string>` | `undefined` | ชื่อห้องจาก API |
| `onOpenShopList` | `() => void` | `undefined` | Callback เมื่อคลิก "รายการร้านค้า" |
| `onOpenCart` | `() => void` | `undefined` | Callback เมื่อคลิกตะกร้า |
| `showUsername` | `boolean` | `false` | แสดงชื่อผู้ใช้ในปุ่มเมนู |
| `className` | `string` | `""` | Class name เพิ่มเติม |

## เมนูรายการ

เมนูจะแสดงรายการต่อไปนี้ (ขึ้นอยู่กับ props):

- หน้าแรก (`/`)
- รายการร้านค้า (แสดงเฉพาะเมื่อมี `onOpenShopList`)
- การติดตาม (`/following`)
- ติดตามสินค้า (`/tracking`)
- ลงทะเบียนร้าน (`/register-shop`)
- จัดการร้านค้า (`/manage-shop`)
- โปรไฟล์ (`/profile`)
- Item Shop (`/manage-shop/packages`)

## หมายเหตุ

ทุกหน้าใช้ `UnifiedHeader` โดยตรงแล้ว — ไม่มี `MapHeader` หรือ `UserPageHeader` ในโปรเจกต์

## ประโยชน์

1. ✅ **Code Reuse:** โค้ดเดียวกันใช้ได้ทุกหน้า
2. ✅ **Consistency:** เมนูเหมือนกันทุกหน้า
3. ✅ **Maintainability:** แก้ไขที่เดียวได้ทุกหน้า
4. ✅ **Flexibility:** ยังคงยืดหยุ่นได้ตาม context

## การทดสอบ

ควรทดสอบหน้าต่อไปนี้:

- [ ] `/` (หน้าแรก - แผนที่)
- [ ] `/profile` (โปรไฟล์)
- [ ] `/register-shop` (ลงทะเบียนร้าน)
- [ ] `/tracking` (ติดตามสินค้า)
- [ ] `/following` (การติดตาม)
- [ ] `/checkout` (สรุปรายการสินค้า)
- [ ] `/shop/[id]` (ดูร้านค้า)
- [ ] `/manage-shop/*` (จัดการร้านค้า)

## หมายเหตุ

- เมนู "รายการร้านค้า" จะแสดงเฉพาะเมื่อมี `onOpenShopList` callback (หน้าแรกเท่านั้น)
- ฟีเจอร์ "เปลี่ยนห้อง" จะแสดงเฉพาะเมื่อ `showRoomSwitcher={true}` และมี `roomOptions`
- ชื่อผู้ใช้จะแสดงเฉพาะเมื่อ `showUsername={true}` และผู้ใช้ล็อกอินแล้ว
