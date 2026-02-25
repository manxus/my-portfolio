import { useState, useEffect, useCallback } from 'react';

export function useKeyboardNav(itemCount, { onSelect, onBack, enabled = true }) {
  const [focusIndex, setFocusIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (e) => {
      if (!enabled || itemCount === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusIndex((prev) => (prev < itemCount - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusIndex((prev) => (prev > 0 ? prev - 1 : itemCount - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusIndex >= 0) onSelect?.(focusIndex);
          break;
        case 'Escape':
          e.preventDefault();
          onBack?.();
          break;
      }
    },
    [enabled, itemCount, focusIndex, onSelect, onBack],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { focusIndex, setFocusIndex };
}
