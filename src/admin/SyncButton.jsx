import { useCallback, useEffect, useState } from 'react';
import { useAdminStore } from '../stores/adminStore';
import styles from './SyncButton.module.css';

/**
 * Runs a game's fetch script on demand, so a dormant game can be refreshed without going to
 * GitHub's workflow_dispatch page.
 *
 * Dev-only by construction, not by choice: the endpoint behind it lives in
 * vite-plugin-admin-api.js as a configureServer hook, and a built site has no such route -- nor
 * anywhere to write the JSON, nor any way to commit it. The `import.meta.env.DEV` guard here
 * matches the one every other admin surface uses: `isAdminUi` folds to false at build time, so a
 * production page renders nothing. The component itself still ships in the bundle, exactly like
 * the rest of the admin UI -- the guard is what makes it inert, not dead-code elimination.
 *
 * The syncable list comes from the server rather than being restated here: the plugin already
 * keeps a fixed table of them, and a second copy in the client would be the thing that drifts.
 */

function formatSynced(iso) {
  if (!iso) return 'never synced';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'never synced';

  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'synced just now';
  if (mins < 60) return `synced ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `synced ${hours}h ago`;
  return `synced ${then.toISOString().slice(0, 10)}`;
}

export default function SyncButton({ gameId }) {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const listSyncTargets = useAdminStore((s) => s.listSyncTargets);
  const runSync = useAdminStore((s) => s.runSync);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [target, setTarget] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState([]);

  // Fetching in a promise callback rather than straight-lining it keeps the setState out of the
  // effect body, and the cancel flag stops a slow response from landing on an unmounted button.
  useEffect(() => {
    if (!isAdminUi) return undefined;

    let cancelled = false;
    listSyncTargets()
      .then(({ targets }) => {
        if (!cancelled) setTarget(targets.find((t) => t.id === gameId) ?? null);
      })
      .catch(() => {
        // A 401 here just means the dev server restarted; the admin toolbar already says so.
        if (!cancelled) setTarget(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdminUi, listSyncTargets, gameId]);

  const onClick = useCallback(async () => {
    setStatus('running');
    setMessage('');
    setWarnings([]);
    try {
      const result = await runSync(gameId);
      setStatus('done');
      // The scripts hold `fetchedAt` still when no counter moved, so an unchanged file is a real
      // answer worth showing -- not a silent no-op that reads like the button did nothing.
      setMessage(result.changed ? 'updated' : 'already up to date');
      setWarnings(result.warnings ?? []);
      setTarget((prev) => (prev ? { ...prev, fetchedAt: result.fetchedAt } : prev));
      if (result.output) console.info(`[sync ${gameId}]\n${result.output}`);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
      setWarnings(err.warnings ?? []);
      if (err.output) console.error(`[sync ${gameId}]\n${err.output}`);
    }
  }, [runSync, gameId]);

  if (!isAdminUi || !target) return null;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.btn}
        onClick={onClick}
        disabled={status === 'running'}
      >
        {status === 'running' ? 'SYNCING…' : 'SYNC NOW'}
      </button>
      <span className={`${styles.status} ${status === 'error' ? styles.error : ''}`}>
        {message || formatSynced(target.fetchedAt)}
      </span>
      {/* A script can succeed and still report drift it cannot fix -- an assignment Battlelog
          counts that the spreadsheet does not, say. Surfaced here because the alternative is
          it sitting unread in a terminal nobody is watching. */}
      {warnings.map((warning) => (
        <span key={warning} className={styles.warning} title={warning}>
          ⚠ {warning}
        </span>
      ))}
    </div>
  );
}
