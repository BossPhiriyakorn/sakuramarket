import { create } from 'zustand';
import { GridState, ViewportState, RoomId, DonationMessage, Parcel, Announcement, RoomRow } from './types';
import { INITIAL_VIEWPORT } from './constants';
import { fetchParcels as fetchParcelsApi } from '@/lib/api/client';

export const DONATION_SOUND_KEY = 'donationSoundEnabled';
/** จำว่าเคยกดปุ่มเปิดเสียงแจ้งเตือนแล้ว (ไม่โชว์โมดัลอีก) */
export const SOUND_UNLOCK_DONE_KEY = 'soundUnlockDone';

let roomsFetchInFlight: Promise<RoomRow[]> | null = null;
const parcelsFetchInFlight = new Map<RoomId, Promise<Parcel[]>>();

async function fetchRoomsOnce(): Promise<RoomRow[]> {
  if (roomsFetchInFlight) return roomsFetchInFlight;
  roomsFetchInFlight = (async () => {
    const res = await fetch('/api/data/rooms', { credentials: 'include' });
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    return list.map((r: { id?: number; name?: string | null; background_url?: string | null; slot_price_per_day?: number | string | null; min_rent_days?: number | string | null }) => ({
      id: Number(r.id) || 0,
      name: r.name ?? null,
      background_url: r.background_url ?? null,
      slot_price_per_day: r.slot_price_per_day != null ? Number(r.slot_price_per_day) : undefined,
      min_rent_days: r.min_rent_days != null ? Number(r.min_rent_days) : undefined,
    }));
  })();
  try {
    return await roomsFetchInFlight;
  } finally {
    roomsFetchInFlight = null;
  }
}

async function fetchParcelsByRoom(room: RoomId): Promise<Parcel[]> {
  const existing = parcelsFetchInFlight.get(room);
  if (existing) return existing;
  const promise = (async () => {
    const pRes = await fetchParcelsApi(room);
    return (pRes as { parcels?: Parcel[] }).parcels ?? [];
  })();
  parcelsFetchInFlight.set(room, promise);
  try {
    return await promise;
  } finally {
    parcelsFetchInFlight.delete(room);
  }
}

export const useStore = create<GridState>((set, get) => ({
  viewport: INITIAL_VIEWPORT,
  isDragging: false,
  mapDragEndedAt: null,
  selectedParcelId: null,
  hoveredGridPos: null,
  parcels: [],
  announcements: [],
  currentRoom: 1,
  showGridLines: false,
  donationSoundEnabled: true,
  donationQueue: [],
  rooms: [],

  setRooms: (rooms: RoomRow[]) => set({ rooms }),

  fetchRooms: () => {
    (async () => {
      try {
        const rooms = await fetchRoomsOnce();
        set({ rooms });
      } catch (_e) {
        set({ rooms: [] });
      }
    })();
  },

  setViewport: (updates: Partial<ViewportState>) => {
    set((state) => ({
      viewport: { ...state.viewport, ...updates },
    }));
  },

  setDragging: (isDragging: boolean) => set({ isDragging }),

  setMapDragEndedAt: (t: number) => set({ mapDragEndedAt: t }),

  selectParcel: (id: string | null) => set({ selectedParcelId: id }),

  setHoveredGridPos: (pos: { x: number, y: number } | null) => set({ hoveredGridPos: pos }),

  setShowGridLines: (show: boolean) => set({ showGridLines: show }),

  setDonationSoundEnabled: (enabled: boolean) => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(DONATION_SOUND_KEY, String(enabled)); } catch (_) {}
    }
    set({ donationSoundEnabled: enabled });
  },

  addDonation: (item: Omit<DonationMessage, 'id' | 'createdAt'>) => {
    const msg: DonationMessage = {
      ...item,
      id: `donation-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };
    set((s) => ({ donationQueue: [...s.donationQueue, msg] }));
  },

  removeDonation: (id: string) => {
    set((s) => ({ donationQueue: s.donationQueue.filter((m) => m.id !== id) }));
  },

  setCurrentRoom: (room: RoomId) => {
    set({ currentRoom: room });
    (async () => {
      try {
        const parcels = await fetchParcelsByRoom(room);
        set({ parcels });
      } catch (_e) {
        set({ parcels: [] });
      }
    })();
  },

  fetchParcels: () => {
    const state = get();
    (async () => {
      try {
        const parcels = await fetchParcelsByRoom(state.currentRoom);
        set({ parcels });
      } catch (_e) {
        set({ parcels: [] });
      }
    })();
  },

  setAnnouncements: (announcements: Announcement[]) => {
    set({ announcements });
  },
}));
