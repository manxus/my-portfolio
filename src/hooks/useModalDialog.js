import { useEffect, useLayoutEffect, useRef } from 'react';
import { setAdminEditorOpen } from '../admin/editorLock';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The behaviour every popup over a page needs, in one place:
 * - Escape closes the popup. PageShell binds Escape to "back to the main menu"
 *   and stands down while the editor-lock flag is set, so the flag is raised
 *   for as long as the popup is open. It also mutes the menu's arrow keys.
 * - Focus moves to `initialFocusRef` (or the first focusable element) on open,
 *   stays inside `panelRef` on Tab, and returns to where it was on close.
 *
 * Pass `open` false to leave everything untouched while the popup is closed.
 */
export function useModalDialog({ open = true, onClose, panelRef, initialFocusRef }) {
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    const returnTo = document.activeElement;
    setAdminEditorOpen(true);
    (initialFocusRef?.current ?? panelRef?.current?.querySelector(FOCUSABLE))?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panelRef?.current) return;
      const focusable = panelRef.current.querySelectorAll(FOCUSABLE);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) return;
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      setAdminEditorOpen(false);
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus();
    };
    // Refs are stable; re-running on them would steal focus mid-dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
