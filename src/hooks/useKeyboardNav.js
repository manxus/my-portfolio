import { useState, useEffect, useCallback, useRef } from 'react';
import { isAdminEditorOpen } from '../admin/editorLock';

function isTypingInField(target) {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"], [role="textbox"]'));
}

/**
 * Arrow/Enter navigation for a list that listens on window. On desktop the menu
 * stays mounted beside the open page, so keys are only taken when focus is on
 * the body or inside `scopeSelector`; anywhere else they belong to the page.
 */
export function useKeyboardNav(itemCount, { onSelect, onBack, enabled = true, scopeSelector }) {
  const [focusIndex, setFocusIndexState] = useState(-1);
  // Enter only fires the highlighted item when the arrows put it there. A
  // highlight left behind by mouse hover must not turn Enter into a menu jump.
  const armedRef = useRef(false);

  // Outside callers are pointer-driven (hover) unless they say otherwise.
  const setFocusIndex = useCallback((value, { keepArmed = false } = {}) => {
    if (!keepArmed) armedRef.current = false;
    setFocusIndexState(value);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (!enabled || e.defaultPrevented || itemCount === 0) return;
      if (isAdminEditorOpen() || isTypingInField(e.target)) return;

      const target = e.target;
      const inScope =
        target === document.body ||
        target === document.documentElement ||
        (scopeSelector && target instanceof Element && target.closest(scopeSelector));
      if (!inScope) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          armedRef.current = true;
          setFocusIndexState((prev) => (prev < itemCount - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          armedRef.current = true;
          setFocusIndexState((prev) => (prev > 0 ? prev - 1 : itemCount - 1));
          break;
        case 'Enter':
          if (!armedRef.current || focusIndex < 0) return;
          e.preventDefault();
          onSelect?.(focusIndex);
          break;
        case 'Escape':
          if (!onBack) return;
          e.preventDefault();
          onBack();
          break;
      }
    },
    [enabled, itemCount, focusIndex, onSelect, onBack, scopeSelector],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { focusIndex, setFocusIndex };
}
