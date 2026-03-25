function enc(hex) {
  return hex.replace('#', '%23');
}

function svgCursor(svg, hotX, hotY, fallback) {
  return `url("data:image/svg+xml;utf8,${svg}") ${hotX} ${hotY}, ${fallback}`;
}

// ---- Crosshair: targeting reticle ----

function crosshairDefault(color) {
  const c = enc(color);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
    `<circle cx='12' cy='12' r='8' fill='none' stroke='${c}' stroke-width='1.5' opacity='0.8'/>` +
    `<line x1='12' y1='0' x2='12' y2='8' stroke='${c}' stroke-width='1.5'/>` +
    `<line x1='12' y1='16' x2='12' y2='24' stroke='${c}' stroke-width='1.5'/>` +
    `<line x1='0' y1='12' x2='8' y2='12' stroke='${c}' stroke-width='1.5'/>` +
    `<line x1='16' y1='12' x2='24' y2='12' stroke='${c}' stroke-width='1.5'/>` +
    `<circle cx='12' cy='12' r='2' fill='${c}'/>` +
    `</svg>`;
  return svgCursor(svg, 12, 12, 'crosshair');
}

function crosshairPointer(color) {
  const c = enc(color);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
    `<circle cx='12' cy='12' r='9' fill='none' stroke='${c}' stroke-width='2' opacity='0.9'/>` +
    `<circle cx='12' cy='12' r='4' fill='${c}' opacity='0.5'/>` +
    `<circle cx='12' cy='12' r='1.5' fill='${c}'/>` +
    `</svg>`;
  return svgCursor(svg, 12, 12, 'pointer');
}

// ---- Dot: small filled circle ----

function dotDefault(color) {
  const c = enc(color);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
    `<circle cx='12' cy='12' r='3' fill='${c}'/>` +
    `</svg>`;
  return svgCursor(svg, 12, 12, 'default');
}

function dotPointer(color) {
  const c = enc(color);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
    `<circle cx='12' cy='12' r='4' fill='${c}' opacity='0.7'/>` +
    `</svg>`;
  return svgCursor(svg, 12, 12, 'pointer');
}

// ---- Ring: thin circle outline ----

function ringDefault(color) {
  const c = enc(color);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
    `<circle cx='12' cy='12' r='9' fill='none' stroke='${c}' stroke-width='1.5' opacity='0.7'/>` +
    `</svg>`;
  return svgCursor(svg, 12, 12, 'default');
}

function ringPointer(color) {
  const c = enc(color);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
    `<circle cx='12' cy='12' r='9' fill='none' stroke='${c}' stroke-width='2' opacity='0.85'/>` +
    `</svg>`;
  return svgCursor(svg, 12, 12, 'pointer');
}

export const CURSOR_STYLES = {
  default: {
    label: 'System',
    getCursors: () => null,
  },
  crosshair: {
    label: 'Crosshair',
    getCursors: (color) => ({
      default: crosshairDefault(color),
      pointer: crosshairPointer(color),
    }),
  },
  dot: {
    label: 'Dot',
    getCursors: (color) => ({
      default: dotDefault(color),
      pointer: dotPointer(color),
    }),
  },
  ring: {
    label: 'Ring',
    getCursors: (color) => ({
      default: ringDefault(color),
      pointer: ringPointer(color),
    }),
  },
};
