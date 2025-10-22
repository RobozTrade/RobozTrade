import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@roboz-trade/shared-types';

interface AuthState {
  user: User | null;
  token: string | null;
  walletAddress: string | null;
  setAuth: (user: User, token: string) => void;
  setWalletAuth: (user: User, token: string, walletAddress: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      walletAddress: null,
      setAuth: (user, token) => set({ user, token, walletAddress: user.walletAddress || null }),
      setWalletAuth: (user, token, walletAddress) => set({ user, token, walletAddress }),
      logout: () => set({ user: null, token: null, walletAddress: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

