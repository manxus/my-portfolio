/**
 * One line glyph per milestone section. The same shape appears twice: small
 * beside the section heading, where it is introduced, and again as an oversized
 * watermark on every card in that section, where it acts as the signature.
 *
 * Stroke rather than fill, so these read as schematic marks next to the mono
 * micro-labels instead of as the solid brand icons used in CommsPanel.
 */
const GLYPH_PATHS = {
  // Spines standing on a shelf.
  library: (
    <>
      <path d="M4 20.5h16" />
      <path d="M6.2 20.5V9h3.2v11.5" />
      <path d="M10.9 20.5V6h3.2v14.5" />
      <path d="M15.6 20.5V12h3.2v8.5" />
    </>
  ),
  // Hourglass.
  hours: (
    <>
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M8.2 3.5v3.3L12 12l-3.8 5.2v3.3" />
      <path d="M15.8 3.5v3.3L12 12l3.8 5.2v3.3" />
    </>
  ),
  // Plumb line dropped from a beam — depth into one title.
  single: (
    <>
      <path d="M6 3.5h12" />
      <path d="M12 3.5v11.3" />
      <path d="M12 14.8l3.2 3.1-3.2 3.1-3.2-3.1z" />
    </>
  ),
  // Medal with ribbon tails.
  perfect: (
    <>
      <circle cx="12" cy="10" r="5.8" />
      <path d="M9.4 10l1.9 1.9 3.4-3.6" />
      <path d="M9.1 15.2L8 21l4-2 4 2-1.1-5.8" />
    </>
  ),
  // Star over a tally of unlocks.
  achievements: (
    <>
      <path d="M12 3.2l2 4.1 4.5.6-3.3 3.2.8 4.5-4-2.2-4 2.2.8-4.5-3.3-3.2 4.5-.6z" />
      <path d="M6 20.3h2.6M10.7 20.3h2.6M15.4 20.3h2.6" />
    </>
  ),
  // Saved-for-later bookmark above the horizon.
  wishlist: (
    <>
      <path d="M8.3 3.5h7.4v12l-3.7-2.9-3.7 2.9z" />
      <path d="M3.5 19.8h17" />
    </>
  ),
  // Faceted gem — the scarce drops.
  rare: (
    <>
      <path d="M7.4 4h9.2l3.9 5.1L12 20.2 3.5 9.1z" />
      <path d="M3.5 9.1h17" />
      <path d="M7.4 4l1.5 5.1L12 20.2l3.1-11.1L16.6 4" />
    </>
  ),
  // Speech bubble over a written rule.
  reviews: (
    <>
      <path d="M3.6 4.5h16.8v11H10l-4.4 3.6V15.5H3.6z" />
      <path d="M7 8.3h9M7 11.4h5.6" />
    </>
  ),
  // Cracked shield — the ones that fought back.
  hallofpain: (
    <>
      <path d="M12 3.3l7 2.4v6c0 4.2-3 7.2-7 9-4-1.8-7-4.8-7-9v-6z" />
      <path d="M12 3.3v5.2l-2.4 2.1 3.6 2-1.8 2.3" />
    </>
  ),
};

export default function SectionGlyph({ id, className, ...rest }) {
  const paths = GLYPH_PATHS[id];
  if (!paths) return null;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {paths}
    </svg>
  );
}
