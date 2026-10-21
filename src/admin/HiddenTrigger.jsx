import { useRef, useCallback } from 'react';

const CLICK_COUNT = 3;
const CLICK_WINDOW = 800;

export default function HiddenTrigger({ onTrigger, children }) {
  const clicksRef = useRef([]);

  const handleClick = useCallback(
    (e) => {
      const now = Date.now();
      clicksRef.current = [
        ...clicksRef.current.filter((t) => now - t < CLICK_WINDOW),
        now,
      ];
      if (clicksRef.current.length >= CLICK_COUNT) {
        clicksRef.current = [];
        e.preventDefault();
        e.stopPropagation();
        onTrigger();
      }
    },
    [onTrigger],
  );

  return (
    <span
      onClick={handleClick}
      style={{
        cursor: 'inherit',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // Triple-tapping on a phone: without this the second tap zooms the page
        // and the third never reaches us.
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        // The copyright line is ~9px tall; pad the hit area to fingertip size
        // without moving anything around it.
        display: 'inline-block',
        padding: '0.75rem 0.5rem',
        margin: '-0.75rem -0.5rem',
      }}
    >
      {children}
    </span>
  );
}
