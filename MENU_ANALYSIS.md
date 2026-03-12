# การวิเคราะห์ระบบเมนูบาร์ในโปรเจค Sakura Market

## สรุปปัญหา

โปรเจคมีเมนูบาร์ 2 แบบที่ทำงานคล้ายกันแต่แยกกัน:

### 1. MapHeader (หน้าแรก - `/`)
**ตำแหน่ง:** `components/map/MapHeader.tsx`
**ใช้ใน:** `App.tsx` → `UIOverlay.tsx`

**คุณสมบัติ:**
- แสดงโลโก้ "SAKURAMARKET" ด้านซ้าย
- ตะกร้าสินค้า + ปุ่มเมนูผู้ใช้ ด้านขวา
- แสดงชื่อผู้ใช้ในปุ่มเมนู (ถ้ามี)
- มีฟีเจอร์ "เปลี่ยนห้อง" ในเมนู
- ไม่มีปุ่มกลับ
- ไม่มีหัวข้อกลาง

**เมนูรายการ:**
- หน้าแรก
- รายการร้านค้า (เปิด slide-out)
- การติดตาม
- ติดตามสินค้า
- ลงทะเบียนร้าน
- จัดการร้านค้า
- โปรไฟล์
- Item Shop

### 2. UserPageHeader (หน้าอื่นๆ)
**ตำแหน่ง:** `components/UserPageHeader.tsx`
**ใช้ใน:** หลายหน้า เช่น `/profile`, `/register-shop`, `/tracking`, `/following`, `/checkout`, `/shop/[id]`, `/manage-shop/*`

**คุณสมบัติ:**
- ปุ่มกลับ (← กลับ) ด้านซ้าย (ไปหน้าแรก)
- หัวข้อกลาง (title) - แสดงชื่อหน้าที่กำลังอยู่
- ตะกร้าสินค้า + ปุ่มเมนู ด้านขวา
- ไม่มีโลโก้
- ไม่มีฟีเจอร์เปลี่ยนห้อง

**เมนูรายการ:** (คล้ายกับ MapHeader แต่ใช้ Link แทน button)
- หน้าแรก
- โปรไฟล์
- จัดการร้านค้า
- ลงทะเบียนร้าน
- การติดตาม
- ติดตามสินค้า
- Item Shop

## สาเหตุที่แยกกัน

### 1. **Context ที่แตกต่างกัน**
- **หน้าแรก:** เป็นแผนที่แบบ interactive ที่ต้องการโลโก้และฟีเจอร์เปลี่ยนห้อง
- **หน้าอื่นๆ:** เป็นหน้าแบบฟอร์ม/รายละเอียด ที่ต้องการปุ่มกลับและหัวข้อ

### 2. **การพัฒนาที่แยกกัน**
- MapHeader พัฒนามาพร้อมกับระบบแผนที่
- UserPageHeader พัฒนามาทีหลังสำหรับหน้าอื่นๆ
- ไม่มีการออกแบบ component แบบ reusable ตั้งแต่แรก

### 3. **ความต้องการที่แตกต่างกัน**
- MapHeader ต้องจัดการกับ room switching
- UserPageHeader ต้องแสดง title ที่แตกต่างกันในแต่ละหน้า
- การนำทางต่างกัน (MapHeader ใช้ router.push, UserPageHeader ใช้ Link)

## ปัญหาที่เกิดขึ้น

1. **Code Duplication:** มีโค้ดซ้ำกันมาก (menu items, cart button, balance display)
2. **Maintenance:** เมื่อต้องแก้ไขเมนู ต้องแก้ 2 ที่
3. **Inconsistency:** เมนูอาจไม่เหมือนกัน 100% (เช่น MapHeader มี "รายการร้านค้า" แต่ UserPageHeader ไม่มี)
4. **UX:** ผู้ใช้เห็นเมนูที่แตกต่างกันในแต่ละหน้า

## วิธีแก้ไข: สร้าง UnifiedHeader Component

### แนวคิด
สร้าง component เดียวที่รองรับทั้ง 2 use cases โดยใช้ props เพื่อควบคุมการแสดงผล

### Props ที่ต้องการ:
```typescript
interface UnifiedHeaderProps {
  // ด้านซ้าย
  showBrand?: boolean;           // แสดงโลโก้ SAKURAMARKET
  showBackButton?: boolean;      // แสดงปุ่มกลับ
  leftContent?: React.ReactNode; // Custom content ด้านซ้าย
  
  // กลาง
  title?: React.ReactNode;       // หัวข้อกลาง (สำหรับหน้าอื่นๆ)
  
  // ฟีเจอร์พิเศษ
  showRoomSwitcher?: boolean;    // แสดงฟีเจอร์เปลี่ยนห้อง
  currentRoom?: RoomId;
  setCurrentRoom?: (room: RoomId) => void;
  roomOptions?: readonly number[];
  roomNames?: Record<number, string>;
  
  // Callbacks
  onOpenShopList?: () => void;
  onOpenCart?: () => void;
}
```

### ประโยชน์:
1. ✅ Code Reuse: โค้ดเดียวกันใช้ได้ทุกหน้า
2. ✅ Consistency: เมนูเหมือนกันทุกหน้า
3. ✅ Maintainability: แก้ไขที่เดียวได้ทุกหน้า
4. ✅ Flexibility: ยังคงยืดหยุ่นได้ตาม context

## แผนการ Migration

1. สร้าง `UnifiedHeader` component
2. อัปเดต `MapHeader` ให้ใช้ `UnifiedHeader` (backward compatible)
3. อัปเดต `UserPageHeader` ให้ใช้ `UnifiedHeader` (backward compatible)
4. ทดสอบทุกหน้า
5. (Optional) ลบ `MapHeader` และ `UserPageHeader` เดิมในอนาคต
