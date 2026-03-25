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
      style={{ cursor: 'inherit', userSelect: 'none' }}
    >
      {children}
    </span>
  );
}
