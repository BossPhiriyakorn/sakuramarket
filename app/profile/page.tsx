"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Wallet,
  Store,
  Mail,
  Phone,
  MessageCircle,
  Pencil,
  X,
  Check,
  AtSign,
  Package,
  Loader2,
  Megaphone,
  Layout,
} from "lucide-react";
import { useProfileStore } from "@/store/profileStore";
import { useToastStore } from "@/store/toastStore";
import { useStore } from "@/store";
import { fetchMyInventory, consumeInventoryItem, fetchMyVerification, submitIdentityVerification, type UserInventoryItem } from "@/lib/api/client";
import { LoadingImage } from "@/components/LoadingImage";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { OnlineBadge } from "@/components/OnlineBadge";
import { Shield, ImageUp, MapPin, CreditCard, ChevronRight } from "lucide-react";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";
import { BookLockModal } from "@/components/BookLockModal";

type AddressBookRow = {
  id: string;
  full_address?: string | null;
  map_url?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  is_default?: boolean;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
};

function chainKeyFromChainId(chainIdHex: string): string {
  const value = Number.parseInt(chainIdHex, 16);
  if (value === 137) return "polygon";
  if (value === 1) return "ethereum";
  if (value === 56) return "bsc";
  if (value === 42161) return "arbitrum";
  if (value === 8453) return "base";
  return "polygon";
}

export default function ProfilePage() {
  const web3Enabled = process.env.NEXT_PUBLIC_WEB3_ENABLED !== "false";
  const [editing, setEditing] = useState(false);
  const {
    username,
    firstName,
    lastName,
    email,
    phone,
    avatarUrl,
    walletAddress,
    contactChannels,
    setUsername,
    setFirstName,
    setLastName,
    setEmail,
    setPhone,
    setAvatarUrl,
    setWalletAddress,
    setContactChannels,
  } = useProfileStore();
  const addToast = useToastStore((s) => s.addToast);

  const [profileTab, setProfileTab] = useState<"profile" | "wallet" | "shop" | "history">("profile");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);

  const [editAddress, setEditAddress] = useState<{
    full_address: string;
    map_url: string;
    recipient_name: string;
    phone: string;
  }>({ full_address: "", map_url: "", recipient_name: "", phone: "" });
  const [editAddressDirty, setEditAddressDirty] = useState(false);
  const [addressBook, setAddressBook] = useState<AddressBookRow[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const handleSave = async () => {
    setProfileSaving(true);
    setProfileSaveError(null);
    try {
      let avatarUrlToSend: string | undefined;
      if (pendingAvatarFile) {
        const form = new FormData();
        form.append("file", pendingAvatarFile);
        form.append("folder", "profile");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error || "อัปโหลดรูปไม่สำเร็จ");
        avatarUrlToSend = (data as { url: string }).url;
        setAvatarUrl(avatarUrlToSend);
        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
        setAvatarPreviewUrl(null);
        setPendingAvatarFile(null);
      }
      const patchRes = await fetch("/api/data/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          ...(avatarUrlToSend !== undefined && { avatar_url: avatarUrlToSend }),
        }),
      });
      if (!patchRes.ok) {
        const d = await patchRes.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || "บันทึกโปรไฟล์ไม่สำเร็จ");
      }
      if (editAddressDirty) {
        const endpoint = selectedAddressId
          ? `/api/data/me/addresses/${selectedAddressId}`
          : "/api/data/me/addresses";
        const method = selectedAddressId ? "PATCH" : "POST";
        const addrRes = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_address: editAddress.full_address,
            map_url: editAddress.map_url || null,
            recipient_name: editAddress.recipient_name || null,
            phone: editAddress.phone || null,
            ...(selectedAddressId ? {} : { is_default: addressBook.length === 0 }),
          }),
        });
        if (!addrRes.ok) {
          const d = await addrRes.json().catch(() => ({}));
          throw new Error((d as { error?: string }).error || "บันทึกที่อยู่ไม่สำเร็จ");
        }
        await loadAddressBook();
        setEditAddressDirty(false);
      }
      await fetch("/api/data/me/profile/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: contactChannels }),
      });
      setEditing(false);
      addToast("บันทึกโปรไฟล์และที่อยู่แล้ว", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setProfileSaveError(msg);
      addToast(msg, "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCancel = () => {
    setEditAddressDirty(false);
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarPreviewUrl(null);
    setPendingAvatarFile(null);
    setEditing(false);
  };

  const handleDeleteAddress = async () => {
    const targetId = selectedAddressId ?? myAddress?.id ?? null;
    if (!targetId) return;
    const ok = window.confirm("ลบที่อยู่นี้ใช่หรือไม่?");
    if (!ok) return;
    setProfileSaveError(null);
    setProfileSaving(true);
    try {
      const res = await fetch(`/api/data/me/addresses/${targetId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "ลบที่อยู่ไม่สำเร็จ");
      await loadAddressBook();
      setEditAddress({ full_address: "", map_url: "", recipient_name: "", phone: "" });
      setSelectedAddressId(null);
      setEditAddressDirty(false);
      addToast("ลบที่อยู่แล้ว", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ลบที่อยู่ไม่สำเร็จ";
      setProfileSaveError(msg);
      addToast(msg, "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const _updateContact = (id: string, value: string) => {
    setContactChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, value } : c))
    );
  };

  const [myLastSeenAt, setMyLastSeenAt] = useState<string | null>(null);

  const fetchMyLastSeenAt = React.useCallback(() => {
    fetch("/api/data/me/presence", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { last_seen_at?: string | null }) => {
        if (typeof data.last_seen_at === "string") setMyLastSeenAt(data.last_seen_at);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMyLastSeenAt();
    const interval = setInterval(fetchMyLastSeenAt, 30_000);
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") fetchMyLastSeenAt();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchMyLastSeenAt]);

  const [inventory, setInventory] = useState<UserInventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [useModal, setUseModal] = useState<{ item: UserInventoryItem } | null>(null);
  const [useMessage, setUseMessage] = useState("");
  const [useLinkUrl, setUseLinkUrl] = useState("");
  const [useLogoUrl, setUseLogoUrl] = useState("");
  const [useSubmitting, setUseSubmitting] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityVerifiedAt, setIdentityVerifiedAt] = useState<string | null>(null);
  const [identityStatus, setIdentityStatus] = useState<string | null>(null);
  const [identityHasDocument, setIdentityHasDocument] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [identityIdCardUrl, setIdentityIdCardUrl] = useState("");
  const [identityPendingFile, setIdentityPendingFile] = useState<File | null>(null);
  const [_identityUploading, setIdentityUploading] = useState(false);
  const [identitySubmitting, setIdentitySubmitting] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const [myAddress, setMyAddress] = useState<AddressBookRow | null>(null);
  const [addressLoading, setAddressLoading] = useState(true);

  const loadAddressBook = async () => {
    setAddressLoading(true);
    try {
      const res = await fetch("/api/data/me/addresses", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { addresses?: AddressBookRow[] };
      const list = Array.isArray(json.addresses) ? json.addresses : [];
      setAddressBook(list);
      const defaultAddress = list.find((a) => a.is_default) ?? list[0] ?? null;
      setMyAddress(defaultAddress);
      if (!selectedAddressId || !list.some((a) => a.id === selectedAddressId)) {
        setSelectedAddressId(defaultAddress?.id ?? null);
      }
    } finally {
      setAddressLoading(false);
    }
  };

  const [myShopData, setMyShopData] = useState<{
    shop: { id: string; shop_name: string; description?: string | null; logo_url?: string | null; logo_background_color?: string | null; cover_url?: string | null } | null;
    registration: { shop_name?: string; description?: string; logo_url?: string | null; logo_background_color?: string | null } | null;
    productCount: number;
    package_plan_name: string | null;
    package_days_left: number | null;
  } | null>(null);
  const [shopContacts, setShopContacts] = useState<{ line: string; phone: string }>({ line: "", phone: "" });
  type OrderRow = {
    id: string;
    status: string;
    total: number;
    created_at: string;
    items: Array<{ product_name: string; quantity: number; line_total: number; shop_name?: string }>;
  };
  type RentalInvoiceRow = {
    id: string;
    status: string;
    amount: number;
    description: string;
    due_date: string | null;
    paid_at: string | null;
    created_at: string;
  };
  type ItemShopPurchaseRow = {
    id: string;
    product_name: string;
    category: string;
    price_unit: string;
    purchased_at: string;
    status: string;
  };
  const [paymentOrders, setPaymentOrders] = useState<OrderRow[]>([]);
  const [rentalInvoices, setRentalInvoices] = useState<RentalInvoiceRow[]>([]);
  const [itemShopPurchases, setItemShopPurchases] = useState<ItemShopPurchaseRow[]>([]);
  const [paymentOrdersLoading, setPaymentOrdersLoading] = useState(false);
  const [paymentDetailModal, setPaymentDetailModal] = useState<
    { type: "order"; data: OrderRow } | { type: "rental"; data: RentalInvoiceRow } | { type: "item_shop"; data: ItemShopPurchaseRow } | null
  >(null);
  const [bookLockModalOpen, setBookLockModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIdentityLoading(true);
    fetchMyVerification()
      .then((res) => {
        if (!cancelled) {
          const r = res as { verified?: boolean; verified_at?: string | null; status?: string | null; has_document?: boolean };
          setIdentityVerified(r.verified ?? false);
          setIdentityVerifiedAt(r.verified_at ?? null);
          setIdentityStatus(r.status ?? null);
          setIdentityHasDocument(r.has_document ?? false);
        }
      })
      .catch(() => {
        if (!cancelled) setIdentityVerified(false);
      })
      .finally(() => {
        if (!cancelled) setIdentityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setInventoryLoading(true);
    fetchMyInventory()
      .then((res) => {
        if (!cancelled) setInventory(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setInventory([]);
      })
      .finally(() => {
        if (!cancelled) setInventoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadAddressBook().catch(() => {
      setAddressBook([]);
      setMyAddress(null);
      setAddressLoading(false);
      setProfileLoadError((e) => e || "โหลดที่อยู่ไม่สำเร็จ");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedAddressId) return;
    const selectedAddress = addressBook.find((a) => a.id === selectedAddressId);
    if (!selectedAddress) return;
    setEditAddress({
      full_address: selectedAddress.full_address ?? "",
      map_url: selectedAddress.map_url ?? "",
      recipient_name: selectedAddress.recipient_name ?? "",
      phone: selectedAddress.phone ?? "",
    });
    setEditAddressDirty(false);
  }, [selectedAddressId, addressBook]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/data/me/shop", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { shop?: { id: string; shop_name: string; logo_url?: string | null; logo_background_color?: string | null } | null; registration?: Record<string, unknown> | null; productCount?: number; package_plan_name?: string | null; package_days_left?: number | null }) => {
        if (!cancelled)
          setMyShopData({
            shop: data.shop ?? null,
            registration: data.registration ?? null,
            productCount: data.productCount ?? 0,
            package_plan_name: data.package_plan_name ?? null,
            package_days_left: data.package_days_left ?? null,
          });
      })
      .catch(() => {
        if (!cancelled) setMyShopData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!myShopData?.shop) {
      setShopContacts({ line: "", phone: "" });
      return;
    }
    let cancelled = false;
    fetch("/api/data/me/shop/contacts", { credentials: "include" })
      .then((r) => r.json())
      .then((res: { channels?: { type: string; value: string }[] }) => {
        if (cancelled) return;
        const ch = res.channels ?? [];
        setShopContacts({
          line: ch.find((c) => c.type === "line")?.value ?? "",
          phone: ch.find((c) => c.type === "phone")?.value ?? "",
        });
      })
      .catch(() => {
        if (!cancelled) setShopContacts({ line: "", phone: "" });
      });
    return () => {
      cancelled = true;
    };
  }, [myShopData?.shop?.id, myShopData?.shop]);

  useEffect(() => {
    let cancelled = false;
    setPaymentOrdersLoading(true);
    Promise.all([
      fetch("/api/data/me/orders", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/data/me/rental-invoices", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/data/me/purchase-history", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([ordersData, invoicesData, purchasesData]) => {
        if (cancelled) return;
        const ord = (ordersData as { orders?: OrderRow[] }).orders;
        const inv = (invoicesData as { invoices?: RentalInvoiceRow[] }).invoices;
        const purchases = (purchasesData as { purchases?: ItemShopPurchaseRow[] }).purchases;
        setPaymentOrders(Array.isArray(ord) ? ord : []);
        setRentalInvoices(Array.isArray(inv) ? inv : []);
        setItemShopPurchases(Array.isArray(purchases) ? purchases : []);
      })
      .catch(() => {
        if (!cancelled) {
          setPaymentOrders([]);
          setRentalInvoices([]);
          setItemShopPurchases([]);
        }
      })
      .finally(() => {
        if (!cancelled) setPaymentOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadInventory = () => {
    fetchMyInventory()
      .then((res) => setInventory(res.items ?? []))
      .catch(() => setInventory([]));
  };

  const handleUseSubmit = async () => {
    if (!useModal) return;
    setUseSubmitting(true);
    setInventoryError(null);
    try {
      const res = await consumeInventoryItem(
        useModal.item.id,
        useMessage,
        undefined,
        useLinkUrl.trim() || null,
        (useModal.item.board_format === "text_link_logo") ? (useLogoUrl.trim() || null) : null
      );
      // ป้ายประกาศ (board) เด้งป๊อปอัป; ประกาศวิ่ง (megaphone) แสดงแค่แถบ Live
      if (res.announcement && useModal.item.category === "board") {
        const senderName = res.announcement.lockLabel
          ? `${res.announcement.shopName} · ${res.announcement.lockLabel}`
          : res.announcement.shopName;
        useStore.getState().addDonation({ senderName, message: res.announcement.message });
      }
      setUseModal(null);
      setUseMessage("");
      setUseLinkUrl("");
      setUseLogoUrl("");
      loadInventory();
    } catch (e) {
      setInventoryError(e instanceof Error ? e.message : "ใช้รายการไม่สำเร็จ");
    } finally {
      setUseSubmitting(false);
    }
  };

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityPendingFile && !identityIdCardUrl.trim()) {
      setIdentityError("กรุณาเลือกไฟล์รูปบัตรประชาชน");
      return;
    }
    setIdentitySubmitting(true);
    setIdentityError(null);
    try {
      let url = identityIdCardUrl.trim();
      if (identityPendingFile) {
        setIdentityUploading(true);
        const form = new FormData();
        form.append("file", identityPendingFile);
        form.append("folder", "profile");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error || "อัปโหลดไม่สำเร็จ");
        url = (data as { url: string }).url;
        setIdentityUploading(false);
      }
      await submitIdentityVerification({
        id_card_url: url,
      });
      setIdentityVerified(false);
      setIdentityVerifiedAt(null);
      setIdentityStatus("pending");
      setIdentityHasDocument(true);
      setIdentityModalOpen(false);
      setIdentityIdCardUrl("");
      setIdentityPendingFile(null);
      addToast("ส่งเอกสารยืนยันตัวตนแล้ว รอตรวจสอบ", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ยืนยันตัวตนไม่สำเร็จ";
      setIdentityError(msg);
      addToast(msg, "error");
    } finally {
      setIdentitySubmitting(false);
    }
  };

  const handleConnectWallet = async () => {
    if (walletConnecting) return;
    if (!web3Enabled) {
      addToast("ฟีเจอร์ผูกกระเป๋ายังไม่เปิดใช้งาน", "error");
      return;
    }
    setWalletConnecting(true);
    try {
      const provider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
      if (!provider) {
        addToast("ไม่พบ MetaMask กรุณาติดตั้งก่อนใช้งาน", "error");
        window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
        return;
      }

      const requiredChainId = Number(process.env.NEXT_PUBLIC_WEB3_CHAIN_ID ?? 137);
      const requiredChainHex = Number.isFinite(requiredChainId) && requiredChainId > 0
        ? `0x${requiredChainId.toString(16)}`
        : null;
      if (requiredChainHex) {
        try {
          const currentChain = String(await provider.request({ method: "eth_chainId" }));
          if (currentChain.toLowerCase() !== requiredChainHex.toLowerCase()) {
            await provider.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: requiredChainHex }],
            });
          }
        } catch (switchErr) {
          const code = Number((switchErr as { code?: number })?.code ?? 0);
          if (code !== 4001) {
            addToast("กรุณาเปลี่ยนเครือข่ายใน MetaMask แล้วลองใหม่", "error");
          }
          return;
        }
      }

      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const accountList = Array.isArray(accounts) ? accounts : [];
      const address = typeof accountList[0] === "string" ? accountList[0] : "";
      if (!address) {
        throw new Error("ไม่พบกระเป๋าที่เชื่อมต่อ");
      }

      const chainHex = String(await provider.request({ method: "eth_chainId" }));
      const chain = chainKeyFromChainId(chainHex);

      const res = await fetch("/api/data/me/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address, chain }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || "ผูกกระเป๋าไม่สำเร็จ");
      }

      const savedAddress =
        typeof (payload as { wallet?: { address?: string } }).wallet?.address === "string"
          ? (payload as { wallet: { address: string } }).wallet.address
          : address;
      setWalletAddress(savedAddress);
      addToast("ผูกกระเป๋า MetaMask สำเร็จ", "success");
      loadProfileFromApi();
    } catch (err) {
      const code = Number((err as { code?: number })?.code ?? 0);
      if (code === 4001) {
        addToast("คุณยกเลิกการเชื่อมต่อกระเป๋า", "error");
        return;
      }
      const msg = err instanceof Error ? err.message : "ผูกกระเป๋าไม่สำเร็จ";
      addToast(msg, "error");
    } finally {
      setWalletConnecting(false);
    }
  };

  const onIdentityIdCardSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdentityPendingFile(file);
      setIdentityError(null);
    }
    e.target.value = "";
  };

  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const onAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      setPendingAvatarFile(file);
      setAvatarPreviewUrl(URL.createObjectURL(file));
      setAvatarError(null);
    }
    e.target.value = "";
  };

  function formatTimeLeft(expiresAt: string | null): string {
    if (!expiresAt) return "—";
    const end = new Date(expiresAt).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return "หมดอายุ";
    const d = Math.floor(diff / (24 * 60 * 60 * 1000));
    const h = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    if (d > 0) return `เหลือ ${d} วัน ${h} ชม.`;
    if (h > 0) return `เหลือ ${h} ชม. ${m} นาที`;
    return `เหลือ ${m} นาที`;
  }

  /** โหลดโปรไฟล์จาก API (ผู้ใช้ที่ล็อกอินอยู่เท่านั้น — แอดมินไม่มีโปรไฟล์ฝั่งผู้ใช้ ส่งไป /admin) */
  const loadProfileFromApi = () => {
    setProfileLoadError(null);
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) {
          window.location.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((me: { user?: { id: string; username?: string; role?: string } } | null) => {
        if (me == null) return;
        const user = me?.user;
        if (!user?.id) {
          window.location.replace("/login");
          return;
        }
        if (user.role === "admin" || user.id === "admin") {
          window.location.replace("/admin");
          return;
        }
        return fetch(`/api/data/users/${user.id}`, { credentials: "include" }).then((r) => {
          if (r.status === 401 || r.status === 404) {
            window.location.replace("/login");
            return null;
          }
          return r.json();
        });
      })
      .then((detail: { user?: Record<string, unknown>; profile?: Record<string, unknown>; wallets?: { address: string }[] } | null) => {
        if (!detail?.user) return;
        const user = detail.user as { username?: string };
        const profile = detail.profile as { first_name?: string; last_name?: string; email?: string; phone?: string; avatar_url?: string } | undefined;
        const wallets = detail.wallets ?? [];
        if (user.username) setUsername(user.username);
        if (profile) {
          setFirstName(profile.first_name ?? "");
          setLastName(profile.last_name ?? "");
          setEmail(profile.email ?? "");
          setPhone(profile.phone ?? "");
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
        }
        const wallet = wallets[0];
        setWalletAddress(wallet?.address ?? "");
        fetch("/api/data/me/profile/contacts", { credentials: "include" })
          .then((r) => r.json())
          .then((res: { channels?: { type: string; value: string; label?: string | null }[] }) => {
            const fromDb = res.channels ?? [];
            const lineVal = fromDb.find((c) => c.type === "line")?.value ?? "";
            const phoneVal = fromDb.find((c) => c.type === "phone")?.value ?? profile?.phone ?? "";
            setContactChannels([
              { id: "c1", type: "line", value: lineVal, label: "LINE" },
              { id: "c2", type: "phone", value: phoneVal, label: "เบอร์โทร" },
            ]);
          })
          .catch(() => {
            setContactChannels([
              { id: "c1", type: "line", value: "", label: "LINE" },
              { id: "c2", type: "phone", value: profile?.phone ?? "", label: "เบอร์โทร" },
            ]);
          });
      })
      .catch(() => setProfileLoadError("โหลดโปรไฟล์ไม่สำเร็จ"));
  };

  useEffect(() => {
    loadProfileFromApi();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.5 }} aria-hidden />
      <div className="relative z-10 flex flex-col flex-1">
      <UnifiedHeader />

      <main className="w-full max-w-2xl mx-auto p-4 md:p-6 space-y-6 flex-1">
        <h1 className="text-xl font-bold text-white">จัดการโปรไฟล์</h1>

        {/* แท็บ: โปรไฟล์ | กระเป๋า | ร้านค้า | ประวัติ — แถบเลือกอยู่ใต้เฉพาะไอคอน+ข้อความ */}
        <div className="flex rounded-t-xl overflow-hidden app-glass-subtle border-b-0 gap-1">
          {(
            [
              { id: "profile" as const, label: "โปรไฟล์", icon: User },
              { id: "wallet" as const, label: "กระเป๋า", icon: Package },
              { id: "shop" as const, label: "ร้านค้า", icon: Store },
              { id: "history" as const, label: "ประวัติ", icon: CreditCard },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setProfileTab(id)}
              className={`flex-1 min-w-0 flex items-center justify-center py-3.5 text-sm font-medium transition-colors ${
                profileTab === id ? "bg-pink-950/30" : "hover:bg-white/5"
              }`}
            >
              <span
                className={`inline-flex items-center gap-1.5 py-3.5 border-b-2 transition-colors ${
                  profileTab === id
                    ? "text-pink-300 border-pink-500"
                    : "text-white/90 border-transparent hover:text-pink-200"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{label}</span>
              </span>
            </button>
          ))}
        </div>

        {profileLoadError && (
          <div className="rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-sm px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <span>{profileLoadError}</span>
            <button
              type="button"
              onClick={() => {
                setProfileLoadError(null);
                loadProfileFromApi();
                loadAddressBook().catch(() => {
                  setAddressBook([]);
                  setMyAddress(null);
                  setAddressLoading(false);
                });
              }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-red-800/50 hover:bg-red-700/50 text-red-200 font-medium text-sm transition-colors"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {profileTab === "profile" && (
        <>
        {/* รูปโปร + ข้อมูลส่วนตัว: ยูสเนม ชื่อ สกุล เบอร์ เมล */}
        <section className="rounded-xl app-glass p-4 md:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2">
              <User size={14} />
              ข้อมูลโปรไฟล์
              <OnlineBadge lastSeenAt={myLastSeenAt} />
            </h2>
            <div className="flex items-center gap-1 shrink-0">
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-semibold shadow-lg shadow-pink-900/40 border border-pink-400/60"
                >
                  <Pencil size={18} />
                  แก้ไข
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                    aria-label="ยกเลิก"
                  >
                    <X size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={profileSaving}
                    className="p-2 rounded-lg text-pink-400 hover:text-white hover:bg-pink-600 disabled:opacity-50"
                    aria-label="บันทึก"
                  >
                    {profileSaving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="shrink-0">
              <label className={`block w-24 h-24 rounded-full overflow-hidden border-2 border-pink-500/50 bg-slate-800 flex items-center justify-center cursor-pointer ${!editing ? "pointer-events-none" : ""}`}>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAvatarSelect}
                  disabled={profileSaving}
                />
                {avatarUrl || avatarPreviewUrl ? (
                  <img
                    src={normalizeImageUrl(avatarPreviewUrl || avatarUrl) ?? ""}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={40} className="text-pink-500/60" />
                )}
              </label>
              {editing && (
                <p className="text-xs text-slate-400 mt-2 text-center">
                  {pendingAvatarFile ? "เลือกรูปแล้ว — กดบันทึกเพื่ออัปโหลด" : "คลิกที่รูปเพื่อเลือกรูปโปรไฟล์"}
                </p>
              )}
              {avatarError && (
                <p className="text-xs text-red-400 mt-1 text-center">{avatarError}</p>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-4">
              {/* ยูสเนม — แสดงอย่างเดียว (ไม่แก้หลังสมัคร) */}
              <div>
                <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                  <AtSign size={12} />
                  ยูสเซอร์เนม
                </label>
                <p className="text-white font-medium font-mono bg-slate-800/80 border border-pink-900/20 rounded-lg px-3 py-2 text-sm">
                  {username || "—"}
                </p>
              </div>

              {editing ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        ชื่อจริง
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500/50"
                        placeholder="กรุณากรอก (หากมี)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        นามสกุล
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500/50"
                        placeholder="กรุณากรอก (หากมี)"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      เบอร์โทร
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500/50"
                      placeholder="กรุณากรอก (หากมี)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      อีเมล
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500/50"
                      placeholder="กรุณากรอก (หากมี)"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block mb-1.5 flex items-center gap-1.5">
                      <MapPin size={12} />
                      ที่อยู่
                    </span>
                    {addressBook.length > 0 && (
                      <div className="mb-2 space-y-1.5">
                        {addressBook.map((addr) => (
                          <div key={addr.id} className="rounded-lg border border-pink-900/20 bg-slate-800/50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAddressId(addr.id);
                                  setEditAddress({
                                    full_address: addr.full_address ?? "",
                                    map_url: addr.map_url ?? "",
                                    recipient_name: addr.recipient_name ?? "",
                                    phone: addr.phone ?? "",
                                  });
                                  setEditAddressDirty(false);
                                }}
                                className={`text-left text-xs ${selectedAddressId === addr.id ? "text-pink-300" : "text-slate-300"}`}
                              >
                                {addr.is_default ? "ค่าเริ่มต้น" : "ที่อยู่อื่น"} · {(addr.recipient_name || "ไม่ระบุชื่อผู้รับ")}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setProfileSaveError(null);
                                  setProfileSaving(true);
                                  try {
                                    const res = await fetch(`/api/data/me/addresses/${addr.id}/set-default`, { method: "POST" });
                                    const data = await res.json().catch(() => ({}));
                                    if (!res.ok) throw new Error((data as { error?: string }).error || "ตั้งค่าเริ่มต้นไม่สำเร็จ");
                                    await loadAddressBook();
                                  } catch (err) {
                                    setProfileSaveError(err instanceof Error ? err.message : "ตั้งค่าเริ่มต้นไม่สำเร็จ");
                                  } finally {
                                    setProfileSaving(false);
                                  }
                                }}
                                disabled={profileSaving || addr.is_default}
                                className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                              >
                                {addr.is_default ? "กำลังใช้งาน" : "ตั้งเป็นค่าเริ่มต้น"}
                              </button>
                            </div>
                            {addr.full_address && <p className="text-xs text-slate-400 whitespace-pre-wrap break-words mt-1">{addr.full_address}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={editAddress.full_address}
                        onChange={(e) => { setEditAddress((prev) => ({ ...prev, full_address: e.target.value })); setEditAddressDirty(true); }}
                        className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500/50 resize-y"
                        placeholder={myAddress?.full_address || "ที่อยู่เต็ม / บ้านเลขที่ ถนน ตำบล จังหวัด"}
                      />
                      <input
                        type="text"
                        value={editAddress.recipient_name}
                        onChange={(e) => { setEditAddress((prev) => ({ ...prev, recipient_name: e.target.value })); setEditAddressDirty(true); }}
                        className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500/50"
                        placeholder={myAddress?.recipient_name || "ชื่อผู้รับ (หากมี)"}
                      />
                      <input
                        type="text"
                        value={editAddress.map_url}
                        onChange={(e) => { setEditAddress((prev) => ({ ...prev, map_url: e.target.value })); setEditAddressDirty(true); }}
                        className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500/50"
                        placeholder={myAddress?.map_url || "ลิงก์ Google Map (หากมี)"}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-slate-500 text-xs break-words">เลือกจากรายการเพื่อแก้ไข หรือเพิ่มรายการใหม่ได้</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAddressId(null);
                            setEditAddress({ full_address: "", map_url: "", recipient_name: "", phone: "" });
                            setEditAddressDirty(true);
                          }}
                          className="text-pink-400 hover:text-pink-300 text-xs"
                        >
                          + เพิ่มที่อยู่ใหม่
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteAddress}
                        disabled={profileSaving || (!selectedAddressId && !myAddress?.id)}
                        className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                      >
                        ลบรายการที่เลือก
                      </button>
                    </div>
                    {!editAddressDirty && myAddress && (
                      <div className="mt-2 space-y-1">
                        {myAddress.full_address && (
                          <p className="text-slate-400 text-xs whitespace-pre-wrap break-words">{myAddress.full_address}</p>
                        )}
                        {myAddress.map_url && (
                          <a href={myAddress.map_url} target="_blank" rel="noopener noreferrer" className="text-pink-400 text-xs inline-flex items-center gap-1">
                            <MapPin size={12} /> ที่อยู่ปัจจุบัน
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  {profileSaveError && (
                    <p className="text-red-400 text-sm">{profileSaveError}</p>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">ชื่อ–นามสกุล</span>
                    <p className="text-white font-medium flex items-center gap-2">
                      {[firstName, lastName].filter(Boolean).join(" ") || "—"}
                      {identityVerified && <VerifiedBadge variant="green" size={18} title="ยืนยันตัวตนแล้ว" />}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">เบอร์โทร</span>
                    <p className="text-slate-300 text-sm flex items-center gap-2">
                      <Phone size={14} className="text-pink-400 shrink-0" />
                      {phone || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">อีเมล</span>
                    <p className="text-slate-300 text-sm flex items-center gap-2">
                      <Mail size={14} className="text-pink-400 shrink-0" />
                      {email || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5 flex items-center gap-1.5">
                      <MapPin size={12} />
                      ที่อยู่ ({addressBook.length} รายการ)
                    </span>
                    {addressLoading ? (
                      <p className="text-slate-500 text-sm">กำลังโหลด...</p>
                    ) : !myAddress || (!myAddress.full_address && !myAddress.map_url) ? (
                      <p className="text-slate-500 text-sm">ยังไม่ได้กรอกที่อยู่</p>
                    ) : (
                      <div className="space-y-1.5 text-sm">
                        {myAddress.full_address && (
                          <p className="text-slate-300 whitespace-pre-wrap">{myAddress.full_address}</p>
                        )}
                        {myAddress.recipient_name && (
                          <p className="text-slate-400">
                            <span className="text-slate-500">ผู้รับ: </span>
                            {myAddress.recipient_name}
                          </p>
                        )}
                        {myAddress.phone && (
                          <p className="text-slate-400 flex items-center gap-1.5">
                            <Phone size={14} className="text-pink-400 shrink-0" />
                            {myAddress.phone}
                          </p>
                        )}
                        {myAddress.map_url && (
                          <a
                            href={myAddress.map_url}
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
                </>
              )}
            </div>
          </div>

          {/* แพ็กเกจ — แสดงแพ็กที่เลือกและวันคงเหลือ */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CreditCard size={14} />
              แพ็กเกจ
            </h3>
            {myShopData?.package_plan_name != null || myShopData?.package_days_left != null ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-200 text-sm font-medium">
                  แพ็กเกจที่ใช้: <span className="text-pink-300">{myShopData?.package_plan_name ?? "—"}</span>
                </span>
                {myShopData?.package_days_left != null && (
                  myShopData.package_days_left > 0 ? (
                    <span className="text-emerald-400 text-sm font-medium">
                      เหลืออีก {myShopData.package_days_left} วัน
                    </span>
                  ) : (
                    <span className="text-amber-400 text-sm font-medium">หมดอายุแล้ว</span>
                  )
                )}
              </div>
            ) : myShopData?.shop ? (
              <p className="text-slate-400 text-sm">ยังไม่มีแพ็กเกจ — เลือกได้ที่รายการแพ็กเกจด้านล่าง</p>
            ) : (
              <p className="text-slate-500 text-sm">ยังไม่มีร้านค้า</p>
            )}
            <Link
              href="/packages"
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-pink-300 hover:text-pink-200"
            >
              ดูรายการแพ็กเกจ
              <ChevronRight size={14} />
            </Link>
          </div>

          {/* กระเป๋าที่ผูก — รวมในข้อมูลโปรไฟล์ */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Wallet size={14} />
              กระเป๋าที่ผูก
            </h3>
            {walletAddress ? (
              <p className="text-slate-300 text-sm font-mono break-all">
                {walletAddress}
              </p>
            ) : (
              <p className="text-slate-400 text-sm">ยังไม่ผูกกระเป๋า</p>
            )}
            <button
              type="button"
              onClick={handleConnectWallet}
              disabled={walletConnecting || !web3Enabled}
              className="mt-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white/15 border border-pink-500/50 text-pink-200 hover:bg-pink-500/30 font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {walletConnecting && <Loader2 size={16} className="animate-spin" />}
              {walletConnecting
                ? "กำลังเชื่อมต่อ..."
                : !web3Enabled
                ? "ยังไม่เปิดใช้งาน Web3"
                : walletAddress
                ? "เปลี่ยนกระเป๋า"
                : "ผูกกระเป๋า"}
            </button>
          </div>

          {/* ยืนยันตัวตน — รวมในข้อมูลโปรไฟล์ */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield size={14} />
              ยืนยันตัวตน
            </h3>
            {identityLoading ? (
              <p className="text-slate-500 text-sm">กำลังโหลด...</p>
            ) : identityVerified ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <VerifiedBadge variant="green" size={24} title="ยืนยันตัวตนแล้ว" />
                <span className="text-sm font-medium">ยืนยันตัวตนแล้ว</span>
                {identityVerifiedAt && (
                  <span className="text-slate-500 text-xs">
                    ({new Date(identityVerifiedAt).toLocaleDateString("th-TH")})
                  </span>
                )}
              </div>
            ) : identityStatus === "pending" && identityHasDocument ? (
              <div className="flex items-center gap-2 text-amber-400">
                <Shield size={20} />
                <span className="text-sm font-medium">รอแอดมินตรวจสอบเอกสาร</span>
              </div>
            ) : identityStatus === "rejected" ? (
              <>
                <p className="text-slate-400 text-sm mb-2">ไม่อนุมัติ — สามารถส่งเอกสารใหม่ได้</p>
                <button
                  type="button"
                  onClick={() => { setIdentityModalOpen(true); setIdentityError(null); }}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-semibold shadow-lg shadow-pink-900/40 border border-pink-400/60"
                >
                  <Shield size={18} />
                  ส่งเอกสารใหม่
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-400 text-sm mb-3">
                  ส่งบัตรประชาชนเพื่อให้แอดมินตรวจสอบ
                </p>
                <button
                  type="button"
                  onClick={() => { setIdentityModalOpen(true); setIdentityError(null); }}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-semibold shadow-lg shadow-pink-900/40 border border-pink-400/60"
                >
                  <Shield size={18} />
                  ยืนยันตัวตน
                </button>
              </>
            )}
          </div>
        </section>
        </>
        )}

        {profileTab === "wallet" && (
        <section className="rounded-xl app-glass p-4">
          <h2 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Package size={14} />
            กระเป๋าเก็บของ
          </h2>
          <p className="text-slate-400 text-sm mb-3">
            ประกาศวิ่งและป้ายประกาศที่ซื้อจาก Item Shop — กดใช้งานแล้วใส่ข้อความได้
          </p>
          {inventoryLoading ? (
            <div className="py-6">
              <LoadingImage message="กำลังโหลดกระเป๋า..." size={56} />
            </div>
          ) : inventory.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">
              ยังไม่มีของในกระเป๋า — ไปซื้อโข่งหรือป้ายประกาศที่{" "}
              <Link href="/manage-shop/packages" className="text-pink-400 hover:text-pink-300">
                Item Shop
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-pink-900/30 text-slate-400">
                    <th className="py-2 pr-2 w-12">รูป</th>
                    <th className="py-2 pr-2">ชื่อ</th>
                    <th className="py-2 pr-2">ประเภท</th>
                    <th className="py-2 pr-2">เวลาแสดง</th>
                    <th className="py-2 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => {
                    const itemImgUrl = getDriveImageDisplayUrl(item.image_url);
                    return (
                    <tr key={item.id} className="border-b border-slate-800/50">
                      <td className="py-2 pr-2">
                        <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center overflow-hidden">
                          {itemImgUrl ? (
                            <img src={itemImgUrl} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-slate-500 text-[10px]">ไม่มีรูป</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-white font-medium min-w-0 break-words">{item.product_name}</td>
                      <td className="py-2 pr-2 text-slate-300">
                        {item.category === "megaphone" ? (
                          <span className="flex items-center gap-1"><Megaphone size={14} /> ประกาศวิ่ง</span>
                        ) : (
                          <span className="flex items-center gap-1"><Layout size={14} /> ป้ายประกาศ</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-slate-300">
                        {item.uses_left !== null ? (
                          <span>ใช้ได้ 1 ครั้ง</span>
                        ) : (
                          <span>{formatTimeLeft(item.expires_at)}</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => { setUseModal({ item }); setUseMessage(""); setUseLinkUrl(""); setUseLogoUrl(""); setInventoryError(null); }}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white text-sm font-semibold shadow-md shadow-pink-900/40 border border-pink-400/60"
                        >
                          ใช้งาน
                        </button>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}

        {profileTab === "shop" && (
        <section className="rounded-xl app-glass overflow-hidden">
          {/* Cover Image */}
          {myShopData?.shop?.cover_url && (
            <div className="w-full h-28 overflow-hidden">
              <img
                src={normalizeImageUrl(myShopData.shop.cover_url) ?? ""}
                alt="ปกร้าน"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="p-4">
            <h2 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Store size={14} />
              ร้านค้า
            </h2>
            {(myShopData?.shop || myShopData?.registration) ? (
              <>
                <div className="flex gap-4 mb-4">
                  {/* โลโก้ร้าน */}
                  {(myShopData.shop?.logo_url || myShopData.registration?.logo_url) ? (
                    <div
                      className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-pink-900/30 flex items-center justify-center"
                      style={{
                        backgroundColor: myShopData.shop?.logo_background_color || myShopData.registration?.logo_background_color || "#1e293b",
                      }}
                    >
                      <img
                        src={normalizeImageUrl((myShopData.shop?.logo_url || myShopData.registration?.logo_url) as string) ?? ""}
                        alt="โลโก้ร้าน"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-800 shrink-0 border border-pink-900/30 flex items-center justify-center">
                      <Store size={32} className="text-pink-500/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-white font-semibold text-base">
                      {myShopData.shop?.shop_name || myShopData.registration?.shop_name || "ร้านของฉัน"}
                    </p>
                    {/* รายละเอียดร้าน — แสดงจาก shop ก่อน ถ้าไม่มีแสดงจาก registration */}
                    {(myShopData.shop?.description || myShopData.registration?.description) && (
                      <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">
                        {myShopData.shop?.description || myShopData.registration?.description}
                      </p>
                    )}
                    <p className="text-slate-500 text-xs">
                      สินค้า {myShopData.productCount ?? 0} รายการ
                    </p>
                    {/* แพ็กเกจและจำนวนวัน */}
                    {myShopData.package_plan_name != null || myShopData.package_days_left != null ? (
                      <p className="text-pink-300/90 text-xs mt-1">
                        แพ็กเกจ: <span className="font-medium">{myShopData.package_plan_name ?? "—"}</span>
                        {myShopData.package_days_left != null && (
                          myShopData.package_days_left > 0
                            ? <span> · เหลือ {myShopData.package_days_left} วัน</span>
                            : <span className="text-amber-400"> · หมดอายุ</span>
                        )}
                      </p>
                    ) : myShopData.shop ? (
                      <p className="text-slate-500 text-xs mt-1">ยังไม่มีแพ็กเกจ</p>
                    ) : null}
                    {/* สถานะ — มีร้านหรือแค่ลงทะเบียนไว้ */}
                    {myShopData.shop ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 rounded-full px-2.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        มีร้านค้าแล้ว
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-950/40 border border-amber-900/40 rounded-full px-2.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        รอเช่าพื้นที่
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setBookLockModalOpen(true)}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white/15 border border-white/30 text-white hover:bg-white/25 font-medium"
                  >
                    <MapPin size={18} />
                    จองล็อคร้าน
                  </button>
                  <Link
                    href="/manage-shop"
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-semibold shadow-lg shadow-pink-900/40 border border-pink-400/60"
                  >
                    <Store size={18} />
                    จัดการร้าน
                  </Link>
                </div>
                {/* ช่องทางติดต่อ — ดึงจากร้านค้า */}
                <div className="pt-3 border-t border-pink-900/30">
                  <h3 className="text-xs font-semibold text-pink-400/90 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <MessageCircle size={12} />
                    ช่องทางติดต่อ
                  </h3>
                  <ul className="space-y-1.5 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <MessageCircle size={14} className="text-pink-400 shrink-0" />
                      <span className="text-slate-400 w-16 shrink-0">LINE:</span>
                      <span className="truncate">{shopContacts.line || "—"}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Phone size={14} className="text-pink-400 shrink-0" />
                      <span className="text-slate-400 w-16 shrink-0">เบอร์โทร:</span>
                      <span className="truncate">{shopContacts.phone || "—"}</span>
                    </li>
                  </ul>
                  <p className="text-slate-500 text-xs mt-2">แก้ไขได้ที่ จัดการร้าน</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-400 text-sm mb-3">
                  ใช้สำหรับขอจองล็อคและลงทะเบียนร้านค้าในตลาด
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setBookLockModalOpen(true)}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white/15 border border-white/30 text-white hover:bg-white/25 font-medium"
                  >
                    <MapPin size={18} />
                    จองล็อคร้าน
                  </button>
                  <Link
                    href="/register-shop"
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-semibold shadow-lg shadow-pink-900/40 border border-pink-400/60"
                  >
                    <Store size={18} />
                    ลงทะเบียนร้านค้า
                  </Link>
                </div>
              </>
            )}
            {/* แสดงช่องทางติดต่อจากร้านเมื่อยังไม่มีร้าน (ข้อความแนะนำ) */}
            {!(myShopData?.shop || myShopData?.registration) && (
              <div className="pt-3 border-t border-pink-900/30">
                <h3 className="text-xs font-semibold text-pink-400/90 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <MessageCircle size={12} />
                  ช่องทางติดต่อ
                </h3>
                <p className="text-slate-500 text-sm">ตั้งค่า LINE และเบอร์โทรได้เมื่อมีร้านค้า (จัดการร้าน)</p>
              </div>
            )}
          </div>
        </section>
        )}

        {profileTab === "history" && (
        <section className="rounded-xl app-glass p-4">
          <h2 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <CreditCard size={14} />
            ประวัติการชำระเงิน
          </h2>
          {paymentOrdersLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : paymentOrders.length === 0 && rentalInvoices.length === 0 && itemShopPurchases.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">ยังไม่มีรายการชำระเงิน</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-pink-900/30 break-words">
                    <th className="pb-2 pr-2 font-medium">ประเภท</th>
                    <th className="pb-2 pr-2 font-medium">รายการ</th>
                    <th className="pb-2 pr-2 font-medium whitespace-nowrap">วันที่</th>
                    <th className="pb-2 pr-2 font-medium text-right">ยอด</th>
                    <th className="pb-2 font-medium">สถานะ</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...paymentOrders.map((o) => ({ type: "order" as const, date: o.created_at, data: o })),
                    ...rentalInvoices.map((r) => ({ type: "rental" as const, date: r.created_at, data: r })),
                    ...itemShopPurchases.map((p) => ({ type: "item_shop" as const, date: p.purchased_at, data: p })),
                  ]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((row) =>
                      row.type === "order" ? (
                        <tr
                          key={`order-${row.data.id}`}
                          className="border-b border-slate-700/50 hover:bg-slate-800/50 cursor-pointer"
                          onClick={() => setPaymentDetailModal({ type: "order", data: row.data })}
                        >
                          <td className="py-2.5 pr-2 text-slate-400 text-xs">คำสั่งซื้อ</td>
                          <td className="py-2.5 pr-2 text-white">#{row.data.id.slice(0, 8)}</td>
                          <td className="py-2.5 pr-2 text-slate-300 whitespace-nowrap">
                            {new Date(row.data.created_at).toLocaleDateString("th-TH", { dateStyle: "short" })}
                          </td>
                          <td className="py-2.5 pr-2 text-right text-slate-200 font-medium">฿{row.data.total.toLocaleString()}</td>
                          <td className="py-2.5 pr-2">
                            <span className={row.data.status === "completed" ? "text-emerald-400" : row.data.status === "cancelled" ? "text-red-400" : "text-amber-400"}>
                              {row.data.status === "completed" ? "ชำระแล้ว" : row.data.status === "cancelled" ? "ยกเลิก" : "รอดำเนินการ"}
                            </span>
                          </td>
                          <td className="py-2.5"><ChevronRight size={16} className="text-slate-500" /></td>
                        </tr>
                      ) : row.type === "rental" ? (
                        <tr
                          key={`rental-${row.data.id}`}
                          className="border-b border-slate-700/50 hover:bg-slate-800/50 cursor-pointer"
                          onClick={() => setPaymentDetailModal({ type: "rental", data: row.data })}
                        >
                          <td className="py-2.5 pr-2 text-slate-400 text-xs">ค่าธรรมเนียมเช่าพื้นที่</td>
                          <td className="py-2.5 pr-2 text-white min-w-0 break-words">{row.data.description || "—"}</td>
                          <td className="py-2.5 pr-2 text-slate-300 whitespace-nowrap">
                            {new Date(row.data.created_at).toLocaleDateString("th-TH", { dateStyle: "short" })}
                          </td>
                          <td className="py-2.5 pr-2 text-right text-slate-200 font-medium">฿{row.data.amount.toLocaleString()}</td>
                          <td className="py-2.5 pr-2">
                            <span className={row.data.status === "paid" ? "text-emerald-400" : row.data.status === "cancelled" ? "text-red-400" : "text-amber-400"}>
                              {row.data.status === "paid" ? "ชำระแล้ว" : row.data.status === "cancelled" ? "ยกเลิก" : "รอชำระ"}
                            </span>
                          </td>
                          <td className="py-2.5"><ChevronRight size={16} className="text-slate-500" /></td>
                        </tr>
                      ) : (
                        <tr
                          key={`item_shop-${row.data.id}`}
                          className="border-b border-slate-700/50 hover:bg-slate-800/50 cursor-pointer"
                          onClick={() => setPaymentDetailModal({ type: "item_shop", data: row.data })}
                        >
                          <td className="py-2.5 pr-2 text-slate-400 text-xs">ซื้อสินค้าในแอป</td>
                          <td className="py-2.5 pr-2 text-white min-w-0 break-words">{row.data.product_name}</td>
                          <td className="py-2.5 pr-2 text-slate-300 whitespace-nowrap">
                            {new Date(row.data.purchased_at).toLocaleDateString("th-TH", { dateStyle: "short" })}
                          </td>
                          <td className="py-2.5 pr-2 text-right text-slate-200 font-medium">
                            {/ฟรี|free|0\s*เหรียญ/i.test(row.data.price_unit) ? "ฟรี" : row.data.price_unit}
                          </td>
                          <td className="py-2.5 pr-2">
                            <span className={row.data.status === "active" ? "text-emerald-400" : row.data.status === "used" ? "text-slate-400" : "text-amber-400"}>
                              {row.data.status === "active" ? "ได้รับแล้ว" : row.data.status === "used" ? "ใช้แล้ว" : "หมดอายุ"}
                            </span>
                          </td>
                          <td className="py-2.5"><ChevronRight size={16} className="text-slate-500" /></td>
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}
      </main>

      {/* โมดัลรายละเอียดคำสั่งซื้อ หรือ ค่าธรรมเนียมเช่าพื้นที่ */}
      {paymentDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setPaymentDetailModal(null)}>
          <div className="rounded-xl border border-pink-900/30 bg-slate-900 w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-pink-900/30 flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-white">
                {paymentDetailModal.type === "order"
                  ? "รายละเอียดคำสั่งซื้อ"
                  : paymentDetailModal.type === "rental"
                    ? "รายละเอียดค่าธรรมเนียมเช่าพื้นที่"
                    : "รายละเอียดการซื้อสินค้าในแอป"}
              </h3>
              <button type="button" onClick={() => setPaymentDetailModal(null)} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {paymentDetailModal.type === "item_shop" ? (
                <>
                  <p className="text-slate-400 text-sm">
                    รายการ: <span className="text-white">{paymentDetailModal.data.product_name}</span>
                  </p>
                  <p className="text-slate-400 text-sm">
                    วันที่ซื้อ: <span className="text-white">{new Date(paymentDetailModal.data.purchased_at).toLocaleString("th-TH")}</span>
                  </p>
                  <p className="text-slate-400 text-sm">
                    ยอด: <span className="text-white">{/ฟรี|free|0\s*เหรียญ/i.test(paymentDetailModal.data.price_unit) ? "ฟรี" : paymentDetailModal.data.price_unit}</span>
                  </p>
                  <p className="text-slate-400 text-sm">
                    สถานะ: <span className={paymentDetailModal.data.status === "active" ? "text-emerald-400" : paymentDetailModal.data.status === "used" ? "text-slate-400" : "text-amber-400"}>
                      {paymentDetailModal.data.status === "active" ? "ได้รับแล้ว" : paymentDetailModal.data.status === "used" ? "ใช้แล้ว" : "หมดอายุ"}
                    </span>
                  </p>
                </>
              ) : paymentDetailModal.type === "order" ? (
                <>
                  <p className="text-slate-400 text-sm">
                    รหัส: <span className="text-white font-mono">{paymentDetailModal.data.id}</span>
                  </p>
                  <p className="text-slate-400 text-sm">
                    วันที่: <span className="text-white">{new Date(paymentDetailModal.data.created_at).toLocaleString("th-TH")}</span>
                  </p>
                  <p className="text-slate-400 text-sm">
                    สถานะ: <span className={paymentDetailModal.data.status === "completed" ? "text-emerald-400" : "text-amber-400"}>
                      {paymentDetailModal.data.status === "completed" ? "ชำระแล้ว" : paymentDetailModal.data.status === "cancelled" ? "ยกเลิก" : "รอดำเนินการ"}
                    </span>
                  </p>
                  <div className="border-t border-pink-900/30 pt-3">
                    <p className="text-xs text-pink-400 uppercase tracking-wider mb-2">รายการสินค้า</p>
                    <ul className="space-y-2">
                      {(paymentDetailModal.data.items ?? []).map((item, i) => (
                        <li key={i} className="flex justify-between text-sm text-slate-300">
                          <span className="truncate mr-2">{item.product_name} × {item.quantity}</span>
                          <span className="shrink-0 font-medium">฿{item.line_total.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-right text-white font-semibold pt-2 border-t border-slate-700">
                    รวม ฿{paymentDetailModal.data.total.toLocaleString()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-slate-400 text-sm">
                    รหัส: <span className="text-white font-mono">{paymentDetailModal.data.id}</span>
                  </p>
                  <p className="text-slate-400 text-sm">
                    รายการ: <span className="text-white">{paymentDetailModal.data.description || "—"}</span>
                  </p>
                  <p className="text-slate-400 text-sm">
                    วันที่ออกใบ: <span className="text-white">{new Date(paymentDetailModal.data.created_at).toLocaleString("th-TH")}</span>
                  </p>
                  {paymentDetailModal.data.due_date && (
                    <p className="text-slate-400 text-sm">
                      วันครบกำหนด: <span className="text-white">{new Date(paymentDetailModal.data.due_date).toLocaleDateString("th-TH")}</span>
                    </p>
                  )}
                  <p className="text-slate-400 text-sm">
                    สถานะ: <span className={paymentDetailModal.data.status === "paid" ? "text-emerald-400" : paymentDetailModal.data.status === "cancelled" ? "text-red-400" : "text-amber-400"}>
                      {paymentDetailModal.data.status === "paid" ? "ชำระแล้ว" : paymentDetailModal.data.status === "cancelled" ? "ยกเลิก" : "รอชำระ"}
                    </span>
                  </p>
                  {paymentDetailModal.data.paid_at && (
                    <p className="text-slate-400 text-sm">
                      วันที่ชำระ: <span className="text-white">{new Date(paymentDetailModal.data.paid_at).toLocaleString("th-TH")}</span>
                    </p>
                  )}
                  <p className="text-right text-white font-semibold pt-2 border-t border-slate-700">
                    ยอด ฿{paymentDetailModal.data.amount.toLocaleString()}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* โมดัลยืนยันตัวตน — ส่งบัตรประชาชน */}
      {identityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="rounded-xl border border-pink-900/30 bg-slate-900 w-full max-w-md">
            <div className="p-4 border-b border-pink-900/30 flex items-center justify-between">
              <h3 className="font-semibold text-white">ยืนยันตัวตน</h3>
              <button type="button" onClick={() => setIdentityModalOpen(false)} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleIdentitySubmit} className="p-4 space-y-4">
              {identityError && <p className="text-red-300 text-sm">{identityError}</p>}
              <div>
                <label className="block text-slate-400 text-sm mb-1">รูปบัตรประชาชน</label>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm cursor-pointer hover:bg-slate-600">
                  <ImageUp size={16} />
                  เลือกไฟล์
                  <input type="file" accept="image/*" className="hidden" onChange={onIdentityIdCardSelect} disabled={identitySubmitting} />
                </label>
                {(identityPendingFile || identityIdCardUrl) && (
                  <p className="text-slate-400 text-xs mt-1">
                    {identityPendingFile ? `เลือกแล้ว: ${identityPendingFile.name}` : "อัปโหลดแล้ว"}
                  </p>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setIdentityModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-700">ยกเลิก</button>
                <button type="submit" disabled={identitySubmitting} className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white disabled:opacity-50 flex items-center gap-2">
                  {identitySubmitting && <Loader2 size={16} className="animate-spin" />}
                  {identitySubmitting ? "กำลังอัปโหลดและส่ง..." : "ส่งยืนยันตัวตน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* โมดัลใช้งานของจากกระเป๋า */}
      {useModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="rounded-xl border border-pink-900/30 bg-slate-900 w-full max-w-md">
            <div className="p-4 border-b border-pink-900/30 flex items-center justify-between">
              <h3 className="font-semibold text-white">ใช้งาน — {useModal.item.product_name}</h3>
              <button type="button" onClick={() => { setUseModal(null); setInventoryError(null); setUseLinkUrl(""); setUseLogoUrl(""); }} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {inventoryError && (
                <p className="text-red-300 text-sm">{inventoryError}</p>
              )}
              <label className="block text-slate-400 text-sm">ข้อความที่จะประกาศ</label>
              <textarea
                value={useMessage}
                onChange={(e) => setUseMessage(e.target.value)}
                placeholder="กรุณากรอก"
                rows={3}
                className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm resize-none"
              />
              {(useModal.item.board_format === "text_link" || useModal.item.board_format === "text_link_logo") && (
                <div>
                  <label className="block text-slate-400 text-sm mb-1">ลิงค์ (ถ้ามี)</label>
                  <input
                    type="url"
                    value={useLinkUrl}
                    onChange={(e) => setUseLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                  />
                </div>
              )}
              {useModal.item.board_format === "text_link_logo" && (
                <div>
                  <label className="block text-slate-400 text-sm mb-1">URL โลโก้ร้าน (ถ้ามี)</label>
                  <input
                    type="url"
                    value={useLogoUrl}
                    onChange={(e) => setUseLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setUseModal(null); setUseLinkUrl(""); setUseLogoUrl(""); }} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-700">
                  ยกเลิก
                </button>
                <button type="button" onClick={handleUseSubmit} disabled={useSubmitting} className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white disabled:opacity-50 flex items-center gap-2">
                  {useSubmitting && <Loader2 size={16} className="animate-spin" />}
                  ส่งประกาศ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BookLockModal
        open={bookLockModalOpen}
        onClose={() => setBookLockModalOpen(false)}
        onBookSuccess={() => setBookLockModalOpen(false)}
      />
      </div>
    </div>
  );
}
