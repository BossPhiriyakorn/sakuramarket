"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, User, Store, CreditCard, Wallet, FileCheck, MapPin, History } from "lucide-react";
import { OnlineBadge } from "@/components/OnlineBadge";
import { normalizeImageUrl } from "@/lib/imageUrl";

const DOC_TYPE_LABEL: Record<string, string> = {
  business_registration: "ทะเบียนพาณิชย์",
  id_card: "บัตรประชาชน",
  tax_id: "เลขประจำตัวผู้เสียภาษี",
};
const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "รอตรวจ",
  approved: "อนุมัติ",
  rejected: "ปฏิเสธ",
};
const MEMBERSHIP_PLAN_LABEL: Record<string, string> = {
  free: "ฟรี",
  basic: "พื้นฐาน",
  premium: "พรีเมียม",
  recommended: "แนะนำ",
  pro: "โปร",
};

type ParcelRow = { id: string; room_id: number; grid_x: number; grid_y: number };
type RoomRow = { id: number; name: string };
type UserDetail = { id: string; username: string; email: string; created_at: string; [k: string]: unknown };
type ProfileDetail = { first_name?: string; last_name?: string; phone?: string; [k: string]: unknown };
type WalletRow = { id: string; address: string; chain: string; is_primary?: boolean };
type VerificationDocRow = { id: string; shop_id: string; document_type: string; file_url: string; status: string; created_at: string };
type ShopRow = { id: string; shop_name: string; parcel_id?: string; verification_status?: string; membership_plan?: string | null; membership_expires_at?: string | null; logo_url?: string; logo_background_color?: string; shop_parcel_ids?: string[] };
type RegRow = { id: string; shop_name: string; logo_url?: string; logo_background_color?: string };
type PaymentRow = { id: string; created_at: string; type: string; amount: number; status: string };
type PayoutRow = { id: string; created_at: string; order_id: string; amount: number; status: string };
type AddressRow = { full_address?: string | null; map_url?: string | null; recipient_name?: string | null; phone?: string | null };

export default function CmsUserDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [verification, setVerification] = useState<{ verified: boolean; verified_at: string | null; status?: string; document_url?: string } | null>(null);
  const [verificationActionLoading, setVerificationActionLoading] = useState(false);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [registrations, setRegistrations] = useState<RegRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [verificationDocs, setVerificationDocs] = useState<VerificationDocRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [parcels, setParcels] = useState<ParcelRow[]>([]);
  const [address, setAddress] = useState<AddressRow | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  type ParcelAuditRow = { id: string; created_at: string; actor_type: string; room_id: number; parcel_id: string | null; slot_count: number; amount_paid: number; outcome: string };
  const [parcelAudit, setParcelAudit] = useState<ParcelAuditRow[]>([]);

  useEffect(() => {
    if (!id) {
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    const opts = { credentials: "include" as RequestCredentials };
    Promise.all([
      fetch(`/api/data/users/${encodeURIComponent(id)}`, opts).then(async (r) => {
        const data = await r.json();
        if (!r.ok) return { ...data, _status: r.status };
        return data;
      }),
      fetch("/api/data/rooms", opts).then((r) => r.json()),
      fetch("/api/data/parcels?roomId=1", opts).then((r) => r.json()),
      fetch("/api/data/parcels?roomId=2", opts).then((r) => r.json()),
    ])
      .then(([detail, roomsData, p1, p2]) => {
        if (detail._status === 401) {
          setUser(null);
          setError("กรุณาเข้าสู่ระบบแอดมินอีกครั้ง");
          return;
        }
        if (detail._status === 404 || detail.error) {
          setUser(null);
          if (detail.error) setError(detail.error);
          return;
        }
        setError(null);
        if (detail.user) {
          setUser(detail.user as UserDetail);
          setProfile((detail.profile ?? null) as ProfileDetail | null);
          setWallets(Array.isArray(detail.wallets) ? (detail.wallets as WalletRow[]) : []);
          setVerification(detail.verification ?? null);
          setShops(Array.isArray(detail.shops) ? (detail.shops as ShopRow[]) : []);
          setRegistrations(Array.isArray(detail.registrations) ? (detail.registrations as RegRow[]) : []);
          setPayments(Array.isArray(detail.payments) ? (detail.payments as PaymentRow[]) : []);
          setPayouts(Array.isArray(detail.payouts) ? (detail.payouts as PayoutRow[]) : []);
          setAddress(detail.address && typeof detail.address === "object" ? (detail.address as AddressRow) : null);
          setLastSeenAt(typeof detail.last_seen_at === "string" ? detail.last_seen_at : null);
          const shopIds = (detail.shops as { id: string }[] ?? []).map((s) => s.id);
          fetch("/api/data/verification-documents", opts)
            .then((r) => r.json())
            .then((docs: Record<string, unknown>[]) => {
              setVerificationDocs(Array.isArray(docs) ? (docs as VerificationDocRow[]).filter((d) => shopIds.includes(d.shop_id)) : []);
            });
          fetch(`/api/data/parcel-booking-audit?actorId=${encodeURIComponent(id)}&actorType=user&limit=20`, opts)
            .then((r) => r.json())
            .then((d: { items?: ParcelAuditRow[] }) => setParcelAudit(Array.isArray(d?.items) ? d.items : []))
            .catch(() => setParcelAudit([]));
        }
        setRooms(Array.isArray(roomsData) ? roomsData : []);
        const a = (p1.parcels ?? []) as ParcelRow[];
        const b = (p2.parcels ?? []) as ParcelRow[];
        setParcels([...a, ...b]);
      })
      .catch((e) => {
        setUser(null);
        setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const getRoomName = (roomId: number) => rooms.find((r) => r.id === roomId)?.name ?? `ห้อง ${roomId}`;
  const getParcelLocation = (parcelId: string) => {
    const p = parcels.find((x) => x.id === parcelId);
    if (!p) return null;
    const columnLetter = String.fromCharCode(65 + (p.grid_x % 26));
    const rowNumber = p.grid_y + 1;
    const lockLabel = `ล็อค ${columnLetter} ${rowNumber}`;
    return {
      room: getRoomName(p.room_id),
      lockDisplay: `${getRoomName(p.room_id)} ${lockLabel}`,
      parcelId: p.id,
    };
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-slate-400">กำลังโหลด...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 md:p-8">
        <Link href="/admin/users" className="text-pink-400 hover:text-pink-300 text-sm flex items-center gap-1 mb-4">
          <ArrowLeft size={16} /> กลับไปรายการผู้ใช้
        </Link>
        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <p className="text-slate-400">{error || "ไม่พบผู้ใช้"}</p>
      </div>
    );
  }

  const status = (user as { status?: string }).status ?? "active";
  const statusLabel: Record<string, string> = {
    active: "ใช้งาน",
    suspended: "ระงับ",
    inactive: "ไม่ใช้งาน",
  };

  const paymentTypeLabel: Record<string, string> = {
    rent: "เช่าที่",
    item: "ซื้อไอเทม",
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <Link href="/admin/users" className="text-pink-400 hover:text-pink-300 text-sm flex items-center gap-1 mb-6">
        <ArrowLeft size={16} /> กลับไปรายการผู้ใช้
      </Link>
      <h1 className="text-xl font-bold text-white">รายละเอียดผู้ใช้</h1>

      {/* การ์ด 1: ข้อมูลส่วนตัว + กระเป๋า + การยืนยันตัวตนลูกค้า */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
            <User size={18} /> ข้อมูลส่วนตัว
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center ring-2 ring-pink-500/30">
                {(profile as { avatar_url?: string })?.avatar_url ? (
                  <img
                    src={normalizeImageUrl((profile as { avatar_url?: string }).avatar_url) ?? ""}
                    alt="รูปโปรไฟล์"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={36} className="text-slate-500" />
                )}
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2 text-sm flex-1 min-w-0">
              <span className="text-slate-500">ยูสเนม</span>
              <span className="text-white font-mono">{user.username}</span>
              <span className="text-slate-500">เมล</span>
              <span className="text-white">{user.email}</span>
              <span className="text-slate-500">ชื่อ</span>
              <span className="text-white">{profile?.first_name ?? "—"}</span>
              <span className="text-slate-500">สกุล</span>
              <span className="text-white">{profile?.last_name ?? "—"}</span>
              <span className="text-slate-500">เบอร์</span>
              <span className="text-white">{profile?.phone || "—"}</span>
              <span className="text-slate-500">วันสมัคร</span>
              <span className="text-white">{new Date(user.created_at).toLocaleDateString("th-TH")}</span>
              <span className="text-slate-500">แพ็กเกจที่เลือก</span>
              <span className="text-white">
                {shops.length === 0
                  ? "—"
                  : (() => {
                      const s = shops[0];
                      return s.membership_plan ? MEMBERSHIP_PLAN_LABEL[s.membership_plan] ?? s.membership_plan : "ยังไม่มีแพ็กเกจ";
                    })()}
              </span>
              <span className="text-slate-500">วันหมดอายุ (แพ็กเกจ)</span>
              <span className="text-white">
                {shops.length === 0
                  ? "—"
                  : shops[0].membership_expires_at
                    ? new Date(shops[0].membership_expires_at).toLocaleDateString("th-TH")
                    : "ไม่มี"}
              </span>
              <span className="text-slate-500">สถานะบัญชี</span>
              <span className="text-white">{statusLabel[status] ?? status}</span>
              <span className="text-slate-500">สถานะออนไลน์</span>
              <span><OnlineBadge lastSeenAt={lastSeenAt} /></span>
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-sm mb-2">กระเป๋าที่ผูกกับบัญชี</p>
              {wallets.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {wallets.map((w) => (
                    <li key={w.id} className="text-white font-mono flex items-center gap-2">
                      <Wallet size={14} className="text-pink-400 shrink-0" />
                      {w.address} ({w.chain}) {w.is_primary && <span className="text-pink-400 text-xs">หลัก</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 text-sm">— ยังไม่มีกระเป๋าผูก</p>
              )}
            </div>
            <div>
              <p className="text-slate-500 text-sm mb-1">การยืนยันตัวตนลูกค้า</p>
              <p className={verification?.verified ? "text-emerald-400" : "text-amber-400"}>
                {verification?.verified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}
                {verification?.verified_at && (
                  <span className="text-slate-500 text-xs ml-2">
                    ({new Date(verification.verified_at).toLocaleDateString("th-TH")})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

      {/* การ์ด ที่อยู่ */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <MapPin size={18} /> ที่อยู่
        </div>
        <div className="p-5">
          {!address || (!address.full_address && !address.map_url) ? (
            <p className="text-slate-500 text-sm">— ยังไม่มีที่อยู่</p>
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

      {/* การ์ด เอกสารยืนยันคน — ยืนยันตัวตน (บัตรประชาชน ฯลฯ) */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <FileCheck size={18} /> เอกสารยืนยันคน
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-slate-500 text-sm">สถานะยืนยันตัวตน</span>
            <span className={
              verification?.verified ? "text-emerald-400 text-sm font-medium" :
              verification?.status === "pending" && verification?.document_url ? "text-amber-400 text-sm font-medium" :
              verification?.status === "pending" ? "text-slate-400 text-sm font-medium" :
              verification?.status === "rejected" ? "text-red-400 text-sm font-medium" : "text-slate-400 text-sm font-medium"
            }>
              {verification?.verified ? "ยืนยันแล้ว" : verification?.status === "pending" && verification?.document_url ? "รอตรวจเอกสาร" : verification?.status === "pending" ? "รอผู้ใช้ส่งเอกสาร" : verification?.status === "rejected" ? "ไม่อนุมัติ" : "ยังไม่ส่ง"}
            </span>
            {verification?.verified_at && (
              <span className="text-slate-500 text-xs">({new Date(verification.verified_at).toLocaleDateString("th-TH")})</span>
            )}
          </div>
          {verification?.document_url ? (
            <p className="text-sm mb-2">
              <a href={verification.document_url} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 underline">
                ดูเอกสาร (รูปบัตร)
              </a>
            </p>
          ) : (
            <p className="text-slate-500 text-sm mb-2">— ยังไม่มีเอกสารยืนยันคน</p>
          )}
          {verification?.status === "pending" && verification?.document_url && id && (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                disabled={verificationActionLoading}
                onClick={async () => {
                  setVerificationActionLoading(true);
                  try {
                    const res = await fetch(`/api/data/users/${id}/verification`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "approve" }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setVerification((v) => v ? { ...v, verified: true, status: "verified", verified_at: new Date().toISOString() } : null);
                    } else {
                      alert(data.error ?? "ดำเนินการไม่สำเร็จ");
                    }
                  } finally {
                    setVerificationActionLoading(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
              >
                อนุมัติ
              </button>
              <button
                type="button"
                disabled={verificationActionLoading}
                onClick={async () => {
                  setVerificationActionLoading(true);
                  try {
                    const res = await fetch(`/api/data/users/${id}/verification`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "reject" }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setVerification((v) => v ? { ...v, verified: false, status: "rejected", verified_at: null } : null);
                    } else {
                      alert(data.error ?? "ดำเนินการไม่สำเร็จ");
                    }
                  } finally {
                    setVerificationActionLoading(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                ไม่อนุมัติ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* การ์ด เอกสารยืนยันร้าน — เอกสารร้านค้า (ทะเบียนพาณิชย์ ฯลฯ) */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <FileCheck size={18} /> เอกสารยืนยันร้าน
        </div>
        <div className="p-5">
          {verificationDocs.length > 0 ? (
            <div className="space-y-3">
              {verificationDocs.map((d) => {
                const shop = shops.find((s) => s.id === d.shop_id);
                return (
                  <div key={d.id} className="rounded-lg border border-pink-900/20 p-3 space-y-2 text-sm">
                    <p className="text-white font-medium">{shop?.shop_name ?? d.shop_id}</p>
                    <div className="grid grid-cols-[100px_1fr] gap-2 text-slate-400">
                      <span>ประเภท</span>
                      <span className="text-white">{DOC_TYPE_LABEL[d.document_type] ?? d.document_type}</span>
                      <span>ไฟล์</span>
                      <span className="text-pink-200 font-mono text-xs truncate">{d.file_url}</span>
                      <span>สถานะ</span>
                      <span className={
                        d.status === "approved" ? "text-emerald-400" :
                        d.status === "rejected" ? "text-red-400" : "text-amber-400"
                      }>
                        {DOC_STATUS_LABEL[d.status] ?? d.status}
                      </span>
                      <span>ส่งเมื่อ</span>
                      <span className="text-slate-300">{new Date(d.created_at).toLocaleDateString("th-TH")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">— ยังไม่มีเอกสารยืนยันร้าน</p>
          )}
        </div>
      </div>

      {/* การ์ด 2: ข้อมูลร้านค้า + สถานะ 3 ตัว + ตำแหน่งถ้าเช่าที่แล้ว */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <Store size={18} /> ข้อมูลร้านค้า
        </div>
        <div className="p-5">
          {shops.length > 0 ? (
            <div className="space-y-4">
              {shops.map((shop) => {
                const parcelIds = shop.shop_parcel_ids ?? (shop.parcel_id ? [shop.parcel_id] : []);
                const locations = parcelIds.map((pid) => getParcelLocation(pid)).filter((x): x is NonNullable<typeof x> => x != null);
                const shopWithLogo = shop as { logo_url?: string; logo_background_color?: string };
                return (
                  <div key={shop.id} className="rounded-lg border border-pink-900/20 p-4 space-y-3 flex gap-4">
                    <div
                      className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: shopWithLogo.logo_background_color ?? "#1e293b" }}
                    >
                      {shopWithLogo.logo_url ? (
                        <img
                          src={normalizeImageUrl(shopWithLogo.logo_url) ?? ""}
                          alt={shop.shop_name}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Store size={28} className="text-white/70" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                    <p className="font-medium text-white">{shop.shop_name}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500 block">เช่าที่</span>
                        <span className="text-white">เช่าที่แล้ว</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">ยืนยันร้าน</span>
                        <span className={shop.verification_status === "verified" ? "text-emerald-400" : "text-amber-400"}>
                          {shop.verification_status === "verified" ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">ร้านแนะนำ</span>
                        <span className="text-white">
                          {shop.membership_plan === "recommended" ? "ร้านแนะนำ" : "—"}
                        </span>
                      </div>
                    </div>
                    {locations.length > 0 && (
                      <p className="text-sm text-slate-400">
                        อยู่ที่: <span className="text-pink-200 font-medium">{locations.map((loc) => loc.lockDisplay).join(", ")}</span>
                      </p>
                    )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {registrations.length > 0 ? (
                <div className="space-y-4">
                  {registrations.map((reg) => (
                    <div key={reg.id} className="rounded-lg border border-pink-900/20 p-4 space-y-3 flex gap-4">
                      <div
                        className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: reg.logo_background_color ?? "#1e293b" }}
                      >
                        {reg.logo_url ? (
                          <img
                            src={normalizeImageUrl(reg.logo_url) ?? ""}
                            alt={reg.shop_name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <Store size={28} className="text-white/70" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                      <p className="font-medium text-white">{reg.shop_name}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-slate-500 block">เช่าที่</span>
                          <span className="text-amber-400">ยังไม่เช่าที่</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">ยืนยันร้าน</span>
                          <span className="text-slate-500">—</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">ร้านแนะนำ</span>
                          <span className="text-white">—</span>
                        </div>
                      </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">— ไม่มีข้อมูลร้านค้า</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* การ์ด 3: ประวัติการชำระ */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <CreditCard size={18} /> ประวัติการชำระ
        </div>
        <div className="p-5">
          {payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-pink-200/80 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-2">วันที่</th>
                    <th className="px-3 py-2">ประเภท</th>
                    <th className="px-3 py-2">จำนวน (เหรียญ)</th>
                    <th className="px-3 py-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-pink-900/20">
                  {payments.map((pay) => (
                    <tr key={pay.id}>
                      <td className="px-3 py-2">{new Date(pay.created_at).toLocaleDateString("th-TH")}</td>
                      <td className="px-3 py-2">{paymentTypeLabel[pay.type] ?? pay.type}</td>
                      <td className="px-3 py-2 font-medium">{pay.amount.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <span className={pay.status === "completed" ? "text-emerald-400" : "text-amber-400"}>
                          {pay.status === "completed" ? "สำเร็จ" : "รอดำเนินการ"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">— ยังไม่มีประวัติการชำระ</p>
          )}
        </div>
      </div>

      {/* การ์ด 4: ยอดที่ได้รับ */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <Wallet size={18} /> ยอดที่ได้รับ
        </div>
        <div className="p-5">
          <p className="text-slate-400 text-sm mb-3">ประวัติยอดที่ได้รับจากระบบเมื่อลูกค้ากดยอมรับสินค้าแล้ว</p>
          {payouts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-pink-200/80 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-2">วันที่</th>
                    <th className="px-3 py-2">คำสั่งซื้อ</th>
                    <th className="px-3 py-2">จำนวน (เหรียญ)</th>
                    <th className="px-3 py-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-pink-900/20">
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2">{new Date(p.created_at).toLocaleDateString("th-TH")}</td>
                      <td className="px-3 py-2 font-mono">{p.order_id}</td>
                      <td className="px-3 py-2 font-medium">{p.amount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-emerald-400">{p.status === "completed" ? "โอนแล้ว" : p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">— ยังไม่มียอดที่ได้รับ</p>
          )}
        </div>
      </div>

      {/* การจองที่โดย user นี้ */}
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-pink-900/30 flex items-center gap-2 text-pink-200 font-semibold">
          <History size={18} /> การจองที่โดย user นี้
        </div>
        <div className="p-5">
          {parcelAudit.length === 0 ? (
            <p className="text-slate-500 text-sm">— ยังไม่มีประวัติการจองที่</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-pink-200/80 uppercase text-xs">
                    <tr>
                      <th className="px-3 py-2">เวลา</th>
                      <th className="px-3 py-2">ห้อง</th>
                      <th className="px-3 py-2">ช่อง</th>
                      <th className="px-3 py-2 text-right">ยอดจ่าย (เหรียญ)</th>
                      <th className="px-3 py-2">ผลลัพธ์</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300 divide-y divide-pink-900/20">
                    {parcelAudit.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-400">{new Date(r.created_at).toLocaleString("th-TH")}</td>
                        <td className="px-3 py-2">{r.room_id}</td>
                        <td className="px-3 py-2">{r.slot_count}</td>
                        <td className="px-3 py-2 text-right">{r.amount_paid.toLocaleString()}</td>
                        <td className="px-3 py-2">{r.outcome === "success" ? "สำเร็จ" : "ล้มเหลว"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/admin/parcel-audit" className="inline-block mt-3 text-pink-400 hover:text-pink-300 text-sm">
                ดูประวัติการจองที่ทั้งหมด →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
