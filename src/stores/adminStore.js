import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The dev API signs tokens with a secret regenerated on every server start, so
 * a tab that outlives a restart keeps rendering the admin UI while every write
 * comes back 401. Spell that out rather than throwing a generic failure.
 */
async function requestError(res, fallback) {
  if (res.status === 401) {
    const err = new Error(
      'Admin session expired — the dev server restarted. Log out and log in again.',
    );
    err.status = 401;
    return err;
  }
  const body = await res.json().catch(() => ({}));
  const err = new Error(body.error || fallback);
  err.status = res.status;
  return err;
}

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
        if (!res.ok) throw await requestError(res, 'Failed to load data');
        return res.json();
      },

      saveData: async (collection, data) => {
        const { authFetch } = get();
        const res = await authFetch(`/api/admin/data/${collection}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (!res.ok) throw await requestError(res, 'Failed to save data');
        return res.json();
      },

      uploadFile: async (file) => {
        const { authFetch } = get();
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        const data = btoa(binary);
        const res = await authFetch('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            data,
            mimeType: file.type,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Upload failed');
        }
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
