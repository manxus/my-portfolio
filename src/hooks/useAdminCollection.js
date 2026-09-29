import { useCallback, useEffect, useState } from 'react';
import { useAdminStore } from '../stores/adminStore';

/**
 * Live copy of a src/data collection for the dev admin UI: fetched when
 * `enabled` turns on, and re-fetched whenever an editor announces a save to it
 * (see notifyAdminCollectionSaved). Returns [data, reload]; data is null while
 * disabled or not yet loaded, so callers fall back to the bundled JSON.
 */
export function useAdminCollection(collection, enabled) {
  const getData = useAdminStore((s) => s.getData);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const load = () =>
      getData(collection)
        .then((next) => {
          if (!cancelled) setData(next);
        })
        .catch((err) => console.error(`Failed to load ${collection}:`, err));

    load();
    const onSaved = (e) => {
      if (e.detail?.collection === collection) load();
    };
    window.addEventListener('admin-collection-saved', onSaved);
    return () => {
      cancelled = true;
      window.removeEventListener('admin-collection-saved', onSaved);
    };
  }, [enabled, collection, getData]);

  /** For callers that write the file themselves and want the result back now. */
  const reload = useCallback(
    () =>
      getData(collection)
        .then(setData)
        .catch((err) => console.error(`Failed to load ${collection}:`, err)),
    [collection, getData],
  );

  return [enabled ? data : null, reload];
}
