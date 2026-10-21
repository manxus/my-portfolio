import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * A token can stop being valid while the tab still renders the admin UI (it
 * expired, or the dev server restarted with a fresh secret), so every write
 * comes back 401. Spell that out rather than throwing a generic failure.
 */
async function requestError(res, fallback) {
  if (res.status === 401) {
    const err = new Error('Admin session expired — log in again.');
    err.status = 401;
    return err;
  }
  const body = await res.json().catch(() => ({}));
  const err = new Error(body.error || fallback);
  err.status = res.status;
  return err;
}

/**
 * ETag of each collection as last read, keyed by name. The live API returns the
 * file's GitHub blob sha; echoing it back as If-Match makes a save over a newer
 * commit (another device, a sync workflow) fail with 409 instead of silently
 * reverting it. The dev API sends none, so dev saves go out unconditioned.
 * Module-level rather than store state: nothing renders from it.
 */
const collectionEtags = new Map();

export const useAdminStore = create(
  persist(
    (set, get) => ({
      token: null,
      isAuthenticated: false,
      /** Bumped on every successful save, so the toolbar can confirm it. Not persisted. */
      lastSavedAt: null,

      /** `code` is the optional TOTP code; it is only sent when filled in. */
      login: async (username, password, code) => {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(code ? { username, password, code } : { username, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Login failed');
        }
        const { token } = await res.json();
        set({ token, isAuthenticated: true });
      },

      logout: () => {
        collectionEtags.clear();
        set({ token: null, isAuthenticated: false });
      },

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
        const etag = res.headers.get('ETag');
        if (etag) collectionEtags.set(collection, etag);
        else collectionEtags.delete(collection);
        return res.json();
      },

      saveData: async (collection, data) => {
        const { authFetch } = get();
        const etag = collectionEtags.get(collection);
        const res = await authFetch(`/api/admin/data/${collection}`, {
          method: 'PUT',
          headers: etag ? { 'If-Match': etag } : undefined,
          body: JSON.stringify(data),
        });
        if (!res.ok) throw await requestError(res, 'Failed to save data');
        // The old sha is spent either way. Take the new one if the response
        // carries it; otherwise the re-pull the saved event triggers fetches it.
        const nextEtag = res.headers.get('ETag');
        if (nextEtag) collectionEtags.set(collection, nextEtag);
        else collectionEtags.delete(collection);
        const body = await res.json();
        set({ lastSavedAt: Date.now() });
        return body;
      },

      /**
       * Live site only. Saves are commits Vercel does not build on their own; this reports how
       * many are waiting (`pending`, null when unknown) and whether a deploy is running.
       */
      getPublishStatus: async () => {
        const { authFetch } = get();
        const res = await authFetch('/api/admin/publish');
        if (!res.ok) throw await requestError(res, 'Failed to load publish status');
        return res.json();
      },

      /** Deploys every save so far in one go. */
      publish: async () => {
        const { authFetch } = get();
        const res = await authFetch('/api/admin/publish', { method: 'POST' });
        if (!res.ok) throw await requestError(res, 'Publish failed');
        return res.json();
      },

      listSyncTargets: async () => {
        const { authFetch } = get();
        const res = await authFetch('/api/admin/sync');
        if (!res.ok) throw await requestError(res, 'Failed to load sync targets');
        return res.json();
      },

      /**
       * Runs a game's fetch script. On the dev server it runs in place and resolves with
       * `{ changed, fetchedAt, warnings }` -- `changed: false` when the snapshot's timestamp did
       * not move, the normal answer for a game nobody has played since the last sync. In
       * production it dispatches the game's GitHub Actions workflow and resolves with
       * `{ queued: true }`.
       */
      runSync: async (id) => {
        const { authFetch } = get();
        const res = await authFetch(`/api/admin/sync/${id}`, { method: 'POST' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err = new Error(body.error || 'Sync failed');
          err.status = res.status;
          err.output = body.output;
          throw err;
        }
        return body;
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
      partialize: ({ token, isAuthenticated }) => ({ token, isAuthenticated }),
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
