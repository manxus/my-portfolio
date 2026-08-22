export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

/**
 * Rows appended to a list whose entrance already finished inherit the hidden variant and never
 * play, so the expander has to remount the list rather than grow it. Remounting means the full list
 * also re-staggers, so the expanded view drops the stagger and lands at once.
 */
export const listVariants = (staggerChildren) => ({
  hidden: {},
  show: { transition: { staggerChildren } },
});
