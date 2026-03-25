import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAdminStore = create(
  persist(
    (set, get) => ({
      token: null,
      isAuthenticated: false,

      login: async (username, password) => {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Login failed');
        }
        const { token } = await res.json();
        set({ token, isAuthenticated: true });
      },

      logout: () => set({ token: null, isAuthenticated: false }),

      verifyToken: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false });
          return false;
        }
        try {
          const res = await fetch('/api/admin/verify', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const { valid } = await res.json();
          if (!valid) set({ token: null, isAuthenticated: false });
          return valid;
        } catch {
          set({ token: null, isAuthenticated: false });
          return false;
        }
      },

      authFetch: async (url, options = {}) => {
        const { token } = get();
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      },

      getData: async (collection) => {
        const { authFetch } = get();
        const res = await authFetch(`/api/admin/data/${collection}`);
        if (!res.ok) throw new Error('Failed to load data');
        return res.json();
      },

      saveData: async (collection, data) => {
        const { authFetch } = get();
        const res = await authFetch(`/api/admin/data/${collection}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to save data');
        return res.json();
      },
    }),
    {
      name: 'bv-admin',
      storage: {
        getItem: (name) => {
          const value = sessionStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => sessionStorage.removeItem(name),
      },
    },
  ),
);
