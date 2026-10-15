import { createContext, useContext } from 'react';
import { useAdminStore } from '../stores/adminStore';

/** Item actions an EditableSection hands to the items rendered inside it. */
export const EditableItemsContext = createContext(null);

/**
 * `(index, itemId, patch) => Promise` that saves a partial update to one item,
 * or null outside an admin session — callers render their quick actions only
 * when it is set.
 */
export function useEditableItemPatch() {
  const ctx = useContext(EditableItemsContext);
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  if (!import.meta.env.DEV || !isAuthenticated || !ctx) return null;
  return ctx.onPatch;
}
