import { useSettingsStore } from '../../stores/settingsStore';

const COLOR_MATRICES = {
  protanopia: [
    0.567, 0.433, 0, 0, 0,
    0.558, 0.442, 0, 0, 0,
    0, 0.242, 0.758, 0, 0,
    0, 0, 0, 1, 0,
  ],
  deuteranopia: [
    0.625, 0.375, 0, 0, 0,
    0.7, 0.3, 0, 0, 0,
    0, 0.3, 0.7, 0, 0,
    0, 0, 0, 1, 0,
  ],
  tritanopia: [
    0.95, 0.05, 0, 0, 0,
    0, 0.433, 0.567, 0, 0,
    0, 0.475, 0.525, 0, 0,
    0, 0, 0, 1, 0,
  ],
  achromatopsia: [
    0.299, 0.587, 0.114, 0, 0,
    0.299, 0.587, 0.114, 0, 0,
    0.299, 0.587, 0.114, 0, 0,
    0, 0, 0, 1, 0,
  ],
};

export default function VisionFilters() {
  const colorblindMode = useSettingsStore((s) => s.colorblindMode);
  const monochrome = useSettingsStore((s) => s.monochrome);

  const activeMode = monochrome ? 'achromatopsia' : colorblindMode;
  const matrix = COLOR_MATRICES[activeMode];

  if (!matrix) return null;

  return (
    <svg
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      aria-hidden="true"
    >
      <defs>
        <filter id="bv-vision-filter" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values={matrix.join(' ')} />
        </filter>
      </defs>
    </svg>
  );
}
