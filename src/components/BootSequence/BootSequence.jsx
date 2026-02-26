import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from '../../hooks/useSound';
import styles from './BootSequence.module.css';

const BOOT_LINES = [
  { text: 'QA_SYSTEMS BIOS v4.2.1', delay: 400, speed: 25 },
  { text: 'Copyright (C) 2024-2026, Build Verified Corp.', delay: 100, speed: 12 },
  { text: '', delay: 500 },
  { text: 'Memory Test .......... 32768 MB OK', delay: 200, speed: 18 },
  { text: 'Detecting primary drive .......... SSD 1TB OK', delay: 200, speed: 18 },
  { text: '', delay: 600 },
  { text: '> Initializing BUILD_VERIFIED v2.4.19 ...', delay: 300, speed: 20 },
  { text: '> Loading QA_Core_Modules .............. [OK]', delay: 80, speed: 14 },
  { text: '> Mounting test_frameworks ............. [OK]', delay: 80, speed: 14 },
  { text: '> Checking for bugs ................... [FOUND: 0]', delay: 80, speed: 14 },
  { text: '> Compiling test_suites ............... [OK]', delay: 80, speed: 14 },
  { text: '> Verifying build integrity ........... [PASSED]', delay: 80, speed: 14 },
  { text: '> Loading user_profile ................ [OK]', delay: 80, speed: 14 },
  { text: '> Establishing secure connection ...... [OK]', delay: 80, speed: 14 },
  { text: '', delay: 500 },
  { text: 'All systems operational.', delay: 300, speed: 22 },
  { text: '', delay: 300 },
  { text: 'BUILD VERIFIED — SYSTEM READY.', delay: 600, speed: 40, highlight: true },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function BootSequence({ onComplete }) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [typingText, setTypingText] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [isTyping, setIsTyping] = useState(true);
  const abortRef = useRef(false);
  const unmountedRef = useRef(false);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    async function runSequence() {
      for (const line of BOOT_LINES) {
        if (abortRef.current || unmountedRef.current) return;
        await sleep(line.delay || 0);
        if (abortRef.current || unmountedRef.current) return;

        if (!line.text) {
          setDisplayedLines((prev) => [...prev, { text: '', highlight: false }]);
          continue;
        }

        for (let i = 1; i <= line.text.length; i++) {
          if (abortRef.current || unmountedRef.current) return;
          setTypingText(line.text.slice(0, i));
          await sleep(line.speed || 20);
        }
        if (abortRef.current || unmountedRef.current) return;

        setDisplayedLines((prev) => [
          ...prev,
          { text: line.text, highlight: line.highlight || false },
        ]);
        setTypingText('');
      }

      if (!unmountedRef.current) {
        setIsTyping(false);
        await sleep(600);
        if (!unmountedRef.current) setShowPrompt(true);
      }
    }

    runSequence();
  }, []);

  const skipToEnd = useCallback(() => {
    abortRef.current = true;
    setTypingText('');
    setDisplayedLines(
      BOOT_LINES.map((l) => ({
        text: l.text,
        highlight: l.highlight || false,
      })),
    );
    setIsTyping(false);
    setShowPrompt(true);
  }, []);

  const handleInteraction = useCallback(() => {
    if (showPrompt) {
      onComplete();
    } else if (isTyping) {
      skipToEnd();
    }
  }, [showPrompt, isTyping, onComplete, skipToEnd]);

  useEffect(() => {
    const onKey = (e) => {
      e.preventDefault();
      handleInteraction();
    };
    const onClick = () => handleInteraction();

    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [handleInteraction]);

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.scanlines} />
      <div className={styles.screen}>
        <div className={styles.terminal}>
          {displayedLines.map((line, i) => (
            <div
              key={i}
              className={`${styles.line} ${line.highlight ? styles.highlight : ''}`}
            >
              {line.text}
            </div>
          ))}

          {typingText && (
            <div className={styles.line}>
              {typingText}
              <span className={styles.cursor}>█</span>
            </div>
          )}

          {!typingText && isTyping && (
            <div className={styles.line}>
              <span className={styles.cursor}>█</span>
            </div>
          )}

          {showPrompt && (
            <motion.div
              className={styles.prompt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {'> '}PRESS ANY KEY TO CONTINUE
            </motion.div>
          )}
        </div>

        <div className={styles.skipHint}>
          {isTyping && 'Click or press any key to skip'}
        </div>
      </div>
    </motion.div>
  );
}
