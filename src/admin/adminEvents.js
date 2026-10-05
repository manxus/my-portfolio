/**
 * Tell any page listening that a collection changed on disk, so it can re-pull.
 *
 * Kept out of EditableSection.jsx so admin surfaces that write outside the
 * editor modal can fire it without importing from a component module.
 */
export function notifyAdminCollectionSaved(collection) {
  window.dispatchEvent(
    new CustomEvent('admin-collection-saved', { detail: { collection } }),
  );
}
