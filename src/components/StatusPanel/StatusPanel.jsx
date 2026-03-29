import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import changelogData from '../../data/changelog.json';

const { changelog } = changelogData;
import PatchModal from '../PatchModal/PatchModal';
import CommsPanel from '../CommsPanel/CommsPanel';
import styles from './StatusPanel.module.css';

function getClientInfo() {
  if (navigator.userAgentData) {
    const { brands = [], platform = '' } = navigator.userAgentData;
    const brandStr = brands.map((b) => b.brand).join(' ');

    let browser = 'CHROMIUM';
    if (brandStr.includes('Firefox')) browser = 'FIREFOX';
    else if (brandStr.includes('Edge')) browser = 'EDGE';
    else if (brandStr.includes('Opera') || brandStr.includes('OPR')) browser = 'OPERA';
    else if (brandStr.includes('Brave')) browser = 'BRAVE';
    else if (brandStr.includes('Google Chrome')) browser = 'CHROME';

    const osMap = { Windows: 'WINDOWS', macOS: 'MACOS', Linux: 'LINUX', Android: 'ANDROID', iOS: 'IOS' };
    const os = osMap[platform] || platform.toUpperCase() || 'UNKNOWN';

    return `${browser} / ${os}`;
  }

  const ua = navigator.userAgent;
  let browser = 'UNKNOWN';
  if (ua.includes('Firefox')) browser = 'FIREFOX';
  else if (ua.includes('Edg')) browser = 'EDGE';
  else if (ua.includes('OPR') || ua.includes('Opera')) browser = 'OPERA';
  else if (ua.includes('Chrome')) browser = 'CHROME';
  else if (ua.includes('Safari')) browser = 'SAFARI';

  let os = 'UNKNOWN';
  if (ua.includes('Windows')) os = 'WINDOWS';
  else if (ua.includes('Mac')) os = 'MACOS';
  else if (ua.includes('Android')) os = 'ANDROID';
  else if (/iPhone|iPad/.test(ua)) os = 'IOS';
  else if (ua.includes('Linux')) os = 'LINUX';

  return `${browser} / ${os}`;
}

function getConnectionType() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return 'ONLINE';
  return (conn.effectiveType || 'online').toUpperCase();
}

function getSessionStart() {
  let start = sessionStorage.getItem('bv_session_start');
  if (!start) {
    start = String(Date.now());
    sessionStorage.setItem('bv_session_start', start);
  }
  return Number(start);
}

function formatUptime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const TAG_LABELS = {
  added: 'ADDED',
  fixed: 'FIXED',
  changed: 'CHANGED',
  removed: 'REMOVED',
};

const BAR_COUNT = 7;

function randomBars() {
  return Array.from({ length: BAR_COUNT }, () => Math.random() * 9 + 2);
}

export default function StatusPanel() {
  const [showModal, setShowModal] = useState(false);
  const sessionStart = useMemo(getSessionStart, []);
  const [uptime, setUptime] = useState(() =>
    Math.floor((Date.now() - sessionStart) / 1000),
  );
  const [localTime, setLocalTime] = useState(() => new Date());
  const [bars, setBars] = useState(randomBars);
  const clientInfo = useMemo(getClientInfo, []);
  const connectionType = useMemo(getConnectionType, []);
  const latest = changelog[0];

  useEffect(() => {
    const tick = setInterval(() => {
      setUptime(Math.floor((Date.now() - sessionStart) / 1000));
      setLocalTime(new Date());
    }, 1000);
    return () => clearInterval(tick);
  }, [sessionStart]);

  useEffect(() => {
    const barTick = setInterval(() => setBars(randomBars()), 600);
    return () => clearInterval(barTick);
  }, []);

  return (
    <motion.aside
      className={styles.panel}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
    >
      <div className={styles.window}>
        <h2 className={styles.windowTitle}>&#9670; System Telemetry</h2>
        <div className={styles.statusGrid}>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Build Status</span>
            <span className={styles.statusValue}>
              <span className={styles.statusDot} />
              STABLE
            </span>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Session Uptime</span>
            <span className={styles.statusValue}>{formatUptime(uptime)}</span>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Local Time</span>
            <span className={styles.statusValue}>{formatTime(localTime)}</span>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Client</span>
            <span className={styles.statusValue}>{clientInfo}</span>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Connection</span>
            <span className={styles.statusValue}>
              {connectionType}
              <span className={styles.networkBars}>
                {bars.map((h, i) => (
                  <span
                    key={i}
                    className={styles.bar}
                    style={{ height: `${h}px` }}
                  />
                ))}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.window}>
        <h3 className={styles.windowTitle}>&#9670; Latest Patch</h3>
        <p className={styles.patchVersion}>v{latest.version}</p>
        <p className={styles.patchDate}>{formatDate(latest.date)}</p>

        {(latest.entries?.length ?? 0) > 0 && (
          <div className={styles.patchPreview}>
            <div className={styles.patchTeaser}>
              <span
                className={`${styles.entryTag} ${
                  latest.entries[0].type === 'fixed'
                    ? styles.entryTagFixed
                    : latest.entries[0].type === 'changed'
                      ? styles.entryTagChanged
                      : ''
                }`}
              >
                [{TAG_LABELS[latest.entries[0].type]}]
              </span>
              <p className={styles.patchTeaserText}>{latest.entries[0].text}</p>
            </div>
            {latest.entries.length > 1 && (
              <p className={styles.patchMore}>
                +{latest.entries.length - 1} more in this release
              </p>
            )}
          </div>
        )}

        <button
          className={styles.changelogLink}
          onClick={() => setShowModal(true)}
        >
          View Details
          <span className={styles.chevron}>&#8250;</span>
        </button>
      </div>

      <CommsPanel />

      <AnimatePresence>
        {showModal && (
          <PatchModal patch={latest} onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
