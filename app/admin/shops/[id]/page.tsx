"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ArrowLeft, Store, Package, Wallet, MapPin, History } from "lucide-react";
import { fetchShopDetail } from "@/lib/api/client";
import { LoadingImage } from "@/components/LoadingImage";
import { WORLD_WIDTH, WORLD_HEIGHT, ROOM_GRID_BACKGROUND } from "../../../../constants";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

type ParcelRow = { id: string; room_id: number; grid_x: number; grid_y: number; width: number; height: number };
type RoomRow = { id: number; name: string; background_url?: string | null; slot_price_per_day?: number; min_rent_days?: number };
type ProfileRow = { first_name: string; last_name: string; phone?: string; email?: string };
type ShopRow = { id: string; user_id: string; parcel_id?: string | null; shop_name: string };
type RegRow = { id: string; user_id: string; shop_name: string };
type PayoutRow = { id: string; order_id: string; amount: number; status: string; paid_at: string | null; created_at: string };
type AddressRow = { full_address?: string | null; map_url?: string | null; recipient_name?: string | null; phone?: string | null };

function PayoutsTable({ payouts, onComplete }: { payouts: PayoutRow[]; onComplete: () => void }) {
  const [completingId, setCompletingId] = React.useState<string | null>(null);
  const handleComplete = (payoutId: string) => {
    setCompletingId(payoutId);
    fetch(`/api/data/shop-payouts/${payoutId}/complete`, { method: "POST" })
      .then((r) => r.json())
      .then((data: { error?: string }) => {
        if (data.error) alert(data.error);
        else onComplete();
      })
      .finally(() => setCompletingId(null));
  };
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-pink-200/80 uppercase text-xs">
          <tr>
            <th className="px-3 py-2">วันที่</th>
            <th className="px-3 py-2">คำสั่งซื้อ</th>
            <th className="px-3 py-2 text-right">จำนวน (เหรียญ)</th>
            <th className="px-3 py-2">สถานะ</th>
            <th className="px-3 py-2 w-24" />
          </tr>
        </thead>
        <tbody className="text-slate-300 divide-y divide-pink-900/20">
          {payouts.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2 whitespace-nowrap text-slate-400">{new Date(p.created_at).toLocaleDateString("th-TH")}</td>
              <td className="px-3 py-2 font-mono text-xs truncate max-w-[120px]" title={p.order_id}>{p.order_id}</td>
              <td className="px-3 py-2 text-right">{p.amount.toLocaleString()}</td>
              <td className="px-3 py-2">{p.status === "completed" ? "โอนแล้ว" : p.status === "pending" ? "รอจ่าย" : p.status}</td>
              <td className="px-3 py-2">
                {p.status === "pending" && (
                  <button
                    type="button"
                    disabled={completingId === p.id}
                    onClick={() => handleComplete(p.id)}
                    className="text-pink-400 hover:text-pink-300 text-xs font-medium disabled:opacity-50"
                  >
                    {completingId === p.id ? "กำลังจ่าย..." : "จ่ายให้ร้าน"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** ขนาดเซลล์เท่ากันกับแอป (32×32 ช่อง) — ใช้ scale เล็กลงเพื่อให้อยู่ใน CMS */
const CELL_PX = 20;

/** คอลัมน์เป็นตัวอักษร A–Z, AA–AF (เหมือนแอป) */
function getColumnLabel(x: number): string {
  if (x < 26) return String.fromCharCode(65 + x);
  return String.fromCharCode(65 + Math.floor(x / 26) - 1) + String.fromCharCode(65 + (x % 26));
}

function getParcelLocationFromCoords(roomName: string, grid_x: number, grid_y: number) {
  const col = getColumnLabel(grid_x);
  const row = grid_y + 1;
  return `${roomName} ล็อค ${col} ${row}`;
}

/** คำนวณว่าแต่ละเซลล์ (x,y) ถูกครอบครองหรือไม่ จาก parcels ที่โหลดจาก API */
function useOccupiedGrid(roomId: number, parcels: ParcelRow[] | undefined) {
  return useMemo(() => {
    const occupied = new Set<string>();
    if (!parcels) return occupied;
    parcels.filter((p) => p.room_id === roomId).forEach((p) => {
      for (let dx = 0; dx < p.width; dx++) {
        for (let dy = 0; dy < p.height; dy++) {
          occupied.add(`${p.grid_x + dx},${p.grid_y + dy}`);
        }
      }
    });
    return occupied;
  }, [roomId, parcels]);
}

/** เซลล์ที่ร้านนี้จองในห้องที่เลือก (สำหรับไฮไลต์บนแผนที่) */
function useThisShopCells(roomId: number, shopParcelIds: string[], parcels: ParcelRow[] | undefined) {
  return useMemo(() => {
    const set = new Set<string>();
    if (!parcels || shopParcelIds.length === 0) return set;
    parcels
      .filter((p) => shopParcelIds.includes(p.id) && p.room_id === roomId)
      .forEach((p) => {
        for (let dx = 0; dx < (p.width || 1); dx++) {
          for (let dy = 0; dy < (p.height || 1); dy++) {
            set.add(`${p.grid_x + dx},${p.grid_y + dy}`);
          }
        }
      });
    return set;
  }, [roomId, shopParcelIds, parcels]);
}

export default function CmsShopDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [data, setData] = useState<{
    shop: ShopRow | null;
    reg: RegRow | null;
    profile: ProfileRow | null;
    address: AddressRow | null;
    productCount: number;
    payouts: PayoutRow[];
    rooms: RoomRow[];
    parcels: ParcelRow[];
    shop_parcel_ids: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  type AuditRow = { id: string; created_at: string; actor_type: string; room_id: number; parcel_id: string | null; slot_count: number; amount_paid: number; outcome: string };
  const [auditItems, setAuditItems] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchShopDetail(id)
      .then((res) => {
        const reg = (res.reg ?? res.shop) as RegRow | null;
        const shop = res.shop as ShopRow | null;
        setData({
          shop,
          reg,
          profile: (res.profile ?? null) as ProfileRow | null,
          address: (res as { address?: AddressRow }).address ?? null,
          productCount: res.productCount ?? 0,
          payouts: (res.payouts ?? []) as PayoutRow[],
          rooms: (res.rooms ?? []) as RoomRow[],
          parcels: (res.parcels ?? []) as ParcelRow[],
          shop_parcel_ids: (res as { shop_parcel_ids?: string[] }).shop_parcel_ids ?? [],
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !data?.shop?.id) {
      setAuditItems([]);
      return;
    }
    fetch(`/api/data/parcel-booking-audit?shopId=${encodeURIComponent(data.shop.id)}&limit=20`)
      .then((r) => r.json())
      .then((d: { items?: AuditRow[] }) => setAuditItems(Array.isArray(d?.items) ? d.items : []))
      .catch(() => setAuditItems([]));
  }, [id, data?.shop?.id]);

  const shop = data?.shop ?? null;
  const reg = data?.reg ?? null;
  const profile = data?.profile ?? null;
  const address = data?.address ?? null;
  const productCount = data?.productCount ?? 0;
  const payouts = data?.payouts ?? [];
  const rooms = data?.rooms ?? [];
  const parcels = data?.parcels;
  const shop_parcel_ids = data?.shop_parcel_ids ?? [];

  const [roomId, setRoomId] = useState(1);

  const currentRoom = rooms.find((r) => r.id === roomId);
  const occupied = useOccupiedGrid(roomId, parcels);
  const thisShopCells = useThisShopCells(roomId, shop_parcel_ids, parcels);

  useEffect(() => {
    if (rooms.length > 0 && !rooms.some((r) => r.id === roomId)) setRoomId(rooms[0].id);
  }, [rooms, roomId, setRoomId]);

  const isThisShop = (x: number, y: number) => thisShopCells.has(`${x},${y}`);
  const isOccupiedByOther = (x: number, y: number) => occupied.has(`${x},${y}`) && !thisShopCells.has(`${x},${y}`);

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <Link href="/admin/shops" className="text-pink-400 hover:text-pink-300 text-sm flex items-center gap-1 mb-4">
          <ArrowLeft size={16} /> กลับไปรายการร้านค้า
        </Link>
        <LoadingImage message="กำลังโหลดรายละเอียดร้าน..." size={64} />
      </div>
    );
  }

  if (!reg && !shop) {
    return (
      <div className="p-6 md:p-8">
        <Link href="/admin/shops" className="text-pink-400 hover:text-pink-300 text-sm flex items-center gap-1 mb-4">
          <ArrowLeft size={16} /> กลับไปรายการร้านค้า
        </Link>
        <p className="text-slate-400">ไม่พบร้านค้า</p>
      </div>
    );
  }

  const shopName = shop?.shop_name ?? reg!.shop_name;
  const isRented = shop_parcel_ids.length > 0;
  const currentLocations: { parcelId: string; label: string }[] = shop_parcel_ids
    .map((pid) => {
      const p = parcels?.find((x) => x.id === pid);
      if (!p) return null;
      const name = rooms.find((r) => r.id === p.room_id)?.name ?? `ห้อง ${p.room_id}`;
      return { parcelId: pid, label: getParcelLocationFromCoords(name, p.grid_x, p.grid_y) };
    })
    .filter((x): x is { parcelId: string; label: string } => x != null);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <Link href="/admin/shops" className="text-pink-400 hover:text-pink-300 text-sm flex items-center gap-1 mb-6">
        <ArrowLeft size={16} /> กลับไปรายการร้านค้า
      </Link>
      <h1 className="text-xl font-bold text-white">รายละเอียดร้านค้า</h1>

      {/* ข้อมูลร้าน */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <Store size={18} /> ข้อมูลร้าน
        </div>
        <div className="p-5 grid grid-cols-[120px_1fr] gap-2 text-sm">
          <span className="text-slate-500">ชื่อร้าน</span>
          <span className="text-white">{shopName}</span>
          <span className="text-slate-500">ชื่อเจ้าของ</span>
          <span className="text-white">{profile ? `${profile.first_name} ${profile.last_name}` : "—"}</span>
          <span className="text-slate-500">เบอร์โทร</span>
          <span className="text-white">{profile?.phone || "—"}</span>
          <span className="text-slate-500">เมล</span>
          <span className="text-white">{profile?.email ?? "—"}</span>
          <span className="text-slate-500">สถานะที่เช่า</span>
          <span className="text-white">{isRented ? "เช่าที่แล้ว" : "ยังไม่เช่าที่"}</span>
        </div>
      </div>

      {/* ที่อยู่ร้าน */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <MapPin size={18} /> ที่อยู่ร้าน
        </div>
        <div className="p-5">
          {!address || (!address.full_address && !address.map_url) ? (
            <p className="text-slate-500 text-sm">— ยังไม่มีที่อยู่ร้าน</p>
          ) : (
            <div className="space-y-2 text-sm">
              {address.full_address && (
                <p className="text-white whitespace-pre-wrap">{address.full_address}</p>
              )}
              {address.recipient_name && (
                <p className="text-slate-300">
                  <span className="text-slate-500">ผู้รับ: </span>
                  {address.recipient_name}
                </p>
              )}
              {address.phone && (
                <p className="text-slate-300">เบอร์ที่อยู่: {address.phone}</p>
              )}
              {address.map_url && (
                <a
                  href={address.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-400 hover:text-pink-300 inline-flex items-center gap-1.5"
                >
                  <MapPin size={14} />
                  เปิดใน Google Map
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* จำนวนสินค้า + ยอดที่ได้รับ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
            <Package size={18} /> จำนวนสินค้า
          </div>
          <div className="p-5 text-2xl font-bold text-white">{productCount} รายการ</div>
        </div>
        <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
            <Wallet size={18} /> ยอดที่ได้รับ
          </div>
          <div className="p-5">
            <p className="text-2xl font-bold text-white">
              {payouts.reduce((sum, p) => sum + p.amount, 0).toLocaleString()} เหรียญ
            </p>
            <p className="text-slate-500 text-xs mt-1">รวม {payouts.length} รายการ</p>
            {payouts.length > 0 && (
              <PayoutsTable payouts={payouts} onComplete={() => id && fetchShopDetail(id).then((res) => setData((d) => (d ? { ...d, payouts: (res.payouts ?? []) as PayoutRow[] } : null)))} />
            )}
          </div>
        </div>
      </div>

      {/* การแสดงผลล็อคที่จอง — แสดงเท่านั้น แอดมินจองให้ลูกค้าไม่ได้จากหน้านี้ */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <MapPin size={18} /> การแสดงผลล็อคที่จอง
        </div>
        <div className="p-5">
          <p className="text-amber-400/90 text-sm mb-4">
            ส่วนนี้เป็นการแสดงผลเท่านั้น — แอดมินไม่สามารถจองให้ลูกค้าได้จากหน้านี้
          </p>

          {/* รายการล็อค: แยก ครั้งแรก / จองเพิ่ม — เรียงตามลำดับการจอง */}
          {currentLocations.length > 0 && (
            <div className="mb-5 space-y-4">
              <p className="text-slate-500 text-xs mb-2">รายการด้านล่างเรียงตามครั้งที่จอง</p>
              <div>
                <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">ล็อคที่จองครั้งแรก</h4>
                <ul className="list-disc list-inside text-pink-200 text-sm space-y-1">
                  {currentLocations.length > 0 && (
                    <li key={currentLocations[0].parcelId}>{currentLocations[0].label}</li>
                  )}
                </ul>
              </div>
              {currentLocations.length > 1 && (
                <div>
                  <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">ล็อคที่จองเพิ่ม</h4>
                  <ul className="list-disc list-inside text-pink-200 text-sm space-y-1">
                    {currentLocations.slice(1).map((loc) => (
                      <li key={loc.parcelId}>{loc.label}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {currentLocations.length === 0 && (
            <p className="text-slate-500 text-sm mb-4">ร้านนี้ยังไม่มีที่จอง</p>
          )}

          <div className="flex flex-wrap items-center gap-4 mb-3">
            <span className="text-slate-500 text-sm">ห้อง (สลับดูแผนที่):</span>
            {rooms.length === 0 ? (
              <span className="text-slate-500 text-sm">ยังไม่มีห้อง</span>
            ) : (
              <select
                value={roomId}
                onChange={(e) => setRoomId(Number(e.target.value))}
                className="rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-1.5 text-sm focus:outline-none focus:border-pink-500/50"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name || `ห้อง ${r.id}`}</option>
                ))}
              </select>
            )}
          </div>

          {/* แผนที่แสดงตำแหน่งล็อคของร้านนี้ (แสดงผลอย่างเดียว) */}
          <div className="relative inline-block rounded-lg overflow-hidden border-2 border-pink-500/50 bg-slate-900 shadow-xl">
            {(currentRoom?.background_url?.trim() || ROOM_GRID_BACKGROUND[roomId as 1 | 2]) && (
              <div
                className="absolute z-0 overflow-hidden pointer-events-none rounded-sm"
                style={{
                  left: 0,
                  top: CELL_PX,
                  width: WORLD_WIDTH * CELL_PX,
                  height: WORLD_HEIGHT * CELL_PX,
                }}
              >
                {(() => {
                  const bgUrl = getDriveImageDisplayUrl(
                    currentRoom?.background_url?.trim() || ROOM_GRID_BACKGROUND[roomId as 1 | 2] || ""
                  );
                  if (!bgUrl) return null;
                  return (
                <Image
                  src={bgUrl}
                  alt=""
                  fill
                  className="object-cover opacity-[0.62]"
                  unoptimized
                  sizes={`${WORLD_WIDTH * CELL_PX}px`}
                />
                  );
                })()}
              </div>
            )}
            <div
              className="relative grid border-collapse"
              style={{
                gridTemplateColumns: `repeat(${WORLD_WIDTH}, ${CELL_PX}px) ${CELL_PX}px`,
                gridTemplateRows: `${CELL_PX}px repeat(${WORLD_HEIGHT}, ${CELL_PX}px)`,
                width: (WORLD_WIDTH + 1) * CELL_PX,
              }}
            >
              {Array.from({ length: WORLD_WIDTH }, (_, x) => (
                <div
                  key={`col-${x}`}
                  className="flex items-center justify-center text-pink-400 font-bold text-xs bg-slate-800/80 border-r border-b border-slate-600"
                  style={{ width: CELL_PX, height: CELL_PX, minWidth: CELL_PX }}
                >
                  {getColumnLabel(x)}
                </div>
              ))}
              <div className="bg-slate-800/80 border-b border-slate-600" style={{ width: CELL_PX, height: CELL_PX }} />
              {Array.from({ length: WORLD_HEIGHT }, (_, y) => (
                <React.Fragment key={`row-${y}`}>
                  {Array.from({ length: WORLD_WIDTH }, (_, x) => {
                    const key = `${x},${y}`;
                    const isShop = isThisShop(x, y);
                    const other = isOccupiedByOther(x, y);
                    const cellClass = isShop
                      ? "border-pink-400 bg-pink-500/80"
                      : other
                        ? "border-red-400 bg-red-500/90"
                        : "border-slate-600 bg-slate-700/90";
                    return (
                      <div
                        key={key}
                        className={`shrink-0 border relative z-10 ${cellClass}`}
                        style={{ width: CELL_PX, height: CELL_PX, minWidth: CELL_PX, minHeight: CELL_PX }}
                        title={isShop ? "ล็อคของร้านนี้" : other ? "ไม่ว่าง (ร้านอื่น)" : "ว่าง"}
                      />
                    );
                  })}
                  <div
                    className="flex items-center justify-center text-pink-400 font-bold text-xs bg-slate-800/80 border-b border-slate-600"
                    style={{ width: CELL_PX, height: CELL_PX, minWidth: CELL_PX }}
                  >
                    {y + 1}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <span className="text-slate-500 text-xs">ล็อคของร้านนี้</span>
            <span className="w-4 h-4 rounded bg-pink-500/80 inline-block" />
            <span className="text-slate-500 text-xs">ร้านอื่นที่จองไปแล้ว</span>
            <span className="w-4 h-4 rounded bg-red-500/90 inline-block" />
          </div>
        </div>
      </div>

      {/* ประวัติการจองที่ของร้านนี้ */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden mt-6">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <History size={18} /> ประวัติการจองที่ของร้านนี้
        </div>
        <div className="p-5">
          {auditItems.length === 0 ? (
            <p className="text-slate-500 text-sm">ยังไม่มีประวัติการจองที่</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-pink-200/80 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-2">เวลา</th>
                    <th className="px-3 py-2">ผู้ทำ</th>
                    <th className="px-3 py-2">ห้อง</th>
                    <th className="px-3 py-2">ช่อง</th>
                    <th className="px-3 py-2 text-right">ยอดจ่าย (เหรียญ)</th>
                    <th className="px-3 py-2">ผลลัพธ์</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-pink-900/20">
                  {auditItems.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-400">{new Date(r.created_at).toLocaleString("th-TH")}</td>
                      <td className="px-3 py-2">{r.actor_type === "admin" ? "แอดมิน" : "ลูกค้า"}</td>
                      <td className="px-3 py-2">{r.room_id}</td>
                      <td className="px-3 py-2">{r.slot_count}</td>
                      <td className="px-3 py-2 text-right">{r.amount_paid.toLocaleString()}</td>
                      <td className="px-3 py-2">{r.outcome === "success" ? "สำเร็จ" : "ล้มเหลว"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {auditItems.length > 0 && (
            <Link href="/admin/parcel-audit" className="inline-block mt-3 text-pink-400 hover:text-pink-300 text-sm">
              ดูประวัติการจองที่ทั้งหมด →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
