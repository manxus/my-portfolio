import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { changelog } from '../../data/changelog';
import PatchModal from '../PatchModal/PatchModal';
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

        <div className={styles.entryList}>
          {latest.entries.map((entry, i) => (
            <div key={i} className={styles.entry}>
              <span
                className={`${styles.entryTag} ${
                  entry.type === 'fixed'
                    ? styles.entryTagFixed
                    : entry.type === 'changed'
                      ? styles.entryTagChanged
                      : ''
                }`}
              >
                [{TAG_LABELS[entry.type]}]
              </span>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>

        <button
          className={styles.changelogLink}
          onClick={() => setShowModal(true)}
        >
          View Details
          <span className={styles.chevron}>&#8250;</span>
        </button>
      </div>

      <div className={styles.window}>
        <h3 className={styles.windowTitle}>&#9670; Comms</h3>
        <div className={styles.linksGrid}>
          <a
            href="https://github.com/manxus"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkItem}
          >
            <svg className={styles.linkIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span>GitHub</span>
          </a>
          <a
            href="https://www.linkedin.com/in/magnusahman/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkItem}
          >
            <svg className={styles.linkIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <span>LinkedIn</span>
          </a>
          <a
            href="https://www.twitch.tv/manxuss"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkItem}
          >
            <svg className={styles.linkIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
            <span>Twitch</span>
          </a>
          <a
            href="https://steamcommunity.com/id/manxuss/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkItem}
          >
            <svg className={styles.linkIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012zm8.399-9.238c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015z" />
            </svg>
            <span>Steam</span>
          </a>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <PatchModal patch={latest} onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
