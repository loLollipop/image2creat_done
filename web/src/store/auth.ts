"use client";

import { create } from "zustand";

import type { AuthMeResponse, AuthUser, PublicSettings } from "@/lib/auth";

interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  settings: PublicSettings | null;
  firstRun: boolean;
  checkedInToday: boolean;
  checkinCredit: number;
  setSession: (payload: AuthMeResponse) => void;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState: Omit<AuthState, "setSession" | "setUser" | "setLoading" | "reset"> = {
  loading: true,
  user: null,
  settings: null,
  firstRun: false,
  checkedInToday: false,
  checkinCredit: 1,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  setSession: (payload) =>
    set({
      loading: false,
      user: payload.user,
      settings: payload.settings,
      firstRun: payload.firstRun,
      checkedInToday: payload.checkin.checkedInToday,
      checkinCredit: payload.checkin.credit,
    }),
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ ...initialState, loading: false }),
}));
