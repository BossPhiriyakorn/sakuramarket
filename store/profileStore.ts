"use client";

import { create } from "zustand";

export interface ProfileContact {
  id: string;
  type: string;
  value: string;
  label?: string;
}

interface ProfileState {
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  walletAddress: string | null;
  contactChannels: ProfileContact[];
  setUsername: (v: string) => void;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setDisplayName: (v: string) => void;
  setEmail: (v: string) => void;
  setPhone: (v: string) => void;
  setAvatarUrl: (v: string | null) => void;
  setWalletAddress: (v: string | null) => void;
  setContactChannels: (v: ProfileContact[] | ((prev: ProfileContact[]) => ProfileContact[])) => void;
  updateProfile: (data: Partial<Pick<ProfileState, "username" | "firstName" | "lastName" | "displayName" | "email" | "phone" | "avatarUrl" | "walletAddress" | "contactChannels">>) => void;
}

const initialContact: ProfileContact[] = [
  { id: "c1", type: "line", value: "", label: "LINE" },
  { id: "c2", type: "phone", value: "", label: "เบอร์โทร" },
];

export const useProfileStore = create<ProfileState>((set) => ({
  username: "",
  firstName: "",
  lastName: "",
  displayName: "",
  email: "",
  phone: "",
  avatarUrl: null,
  walletAddress: null,
  contactChannels: initialContact,
  setUsername: (v) => set({ username: v }),
  setFirstName: (v) => set({ firstName: v }),
  setLastName: (v) => set({ lastName: v }),
  setDisplayName: (v) => set({ displayName: v }),
  setEmail: (v) => set({ email: v }),
  setPhone: (v) => set({ phone: v }),
  setAvatarUrl: (v) => set({ avatarUrl: v }),
  setWalletAddress: (v) => set({ walletAddress: v }),
  setContactChannels: (v) =>
    set((s) => ({
      contactChannels: typeof v === "function" ? v(s.contactChannels) : v,
    })),
  updateProfile: (data) => set((s) => ({ ...s, ...data })),
}));
