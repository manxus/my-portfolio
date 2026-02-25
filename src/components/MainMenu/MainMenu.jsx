import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { menuItems, patchNotes } from '../../data/menu';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { useSound } from '../../hooks/useSound';
import ExitModal from '../ExitModal/ExitModal';
import MenuBackground from '../MenuBackground/MenuBackground';
import styles from './MainMenu.module.css';

export default function MainMenu() {
  const navigate = useNavigate();
  const { play } = useSound();
  const [expandedItem, setExpandedItem] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [showExit, setShowExit] = useState(false);
  const menuRef = useRef(null);

  const flatItems = useMemo(() => {
    const items = [];
    for (const item of menuItems) {
      items.push({ type: 'parent', ...item });
      if (item.children && expandedItem === item.id) {
        for (const child of item.children) {
          items.push({ type: 'child', parentId: item.id, ...child });
        }
      }
    }
    return items;
  }, [expandedItem]);

  const handleItemAction = useCallback(
    (item) => {
      if (item.action === 'exit') {
        play('error');
        setShowExit(true);
        return;
      }
      if (item.children) {
        setExpandedItem((prev) => {
          const next = prev === item.id ? null : item.id;
          play(next ? 'expand' : 'collapse');
          return next;
        });
        return;
      }
      if (item.path) {
        play('select');
        navigate(item.path);
      }
    },
    [navigate, play],
  );

  const handleSelect = useCallback(
    (index) => {
      const item = flatItems[index];
      if (!item) return;

      if (item.type === 'child' && item.path) {
        navigate(item.path);
      } else {
        handleItemAction(item);
      }
    },
    [flatItems, navigate, handleItemAction],
  );

  const { focusIndex, setFocusIndex } = useKeyboardNav(flatItems.length, {
    onSelect: handleSelect,
    enabled: !showExit,
  });

  useEffect(() => {
    if (focusIndex >= 0 && focusIndex < flatItems.length) {
      setHoveredItem(flatItems[focusIndex].id);
    }
  }, [focusIndex, flatItems]);

  const getDescription = () => {
    if (!hoveredItem) return null;
    for (const item of menuItems) {
      if (item.id === hoveredItem) return item.description;
      if (item.children) {
        const child = item.children.find((c) => c.id === hoveredItem);
        if (child) return child.description;
      }
    }
    return null;
  };

  let flatIndex = 0;
  const getFlatIndex = () => flatIndex++;

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.bgGradient} />
      <MenuBackground />

      <div className={styles.menuPanel} ref={menuRef}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <span className={styles.titleBold}>BUILD</span>{' '}
            <span className={styles.titleLight}>VERIFIED</span>
            <span className={styles.titleIcon}>&#9673;</span>
          </h1>
          <p className={styles.subtitle}>
            QUALITY ASSURANCE DIVISION // BUILD SECTOR 04
          </p>
        </header>

        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const parentIdx = getFlatIndex();
            const isExpanded = expandedItem === item.id;
            const isFocused = focusIndex === parentIdx - 1;
            const isHovered = hoveredItem === item.id;

            return (
              <div key={item.id} className={styles.menuGroup}>
                <button
                  className={`${styles.menuItem} ${isExpanded ? styles.active : ''} ${isFocused ? styles.focused : ''}`}
                  onClick={() => handleItemAction(item)}
                  onMouseEnter={() => {
                    play('hover');
                    setHoveredItem(item.id);
                    setFocusIndex(parentIdx - 1);
                  }}
                  onMouseLeave={() => {
                    if (hoveredItem === item.id) setHoveredItem(null);
                  }}
                >
                  <span className={styles.menuLabel}>{item.label}</span>
                  {item.children && (
                    <motion.span
                      className={styles.chevron}
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      &#8250;
                    </motion.span>
                  )}
                </button>

                <AnimatePresence>
                  {item.children && isExpanded && (
                    <motion.div
                      className={styles.submenu}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      {item.children.map((child) => {
                        const childIdx = getFlatIndex();
                        const childFocused = focusIndex === childIdx - 1;

                        return (
                          <button
                            key={child.id}
                            className={`${styles.submenuItem} ${childFocused ? styles.focused : ''}`}
                            onClick={() => {
                              play('select');
                              navigate(child.path);
                            }}
                            onMouseEnter={() => {
                              play('hover');
                              setHoveredItem(child.id);
                              setFocusIndex(childIdx - 1);
                            }}
                            onMouseLeave={() => {
                              if (hoveredItem === child.id) setHoveredItem(null);
                            }}
                          >
                            <span className={styles.bullet}>&#8226;</span>
                            <span>{child.label}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <footer className={styles.footer}>
          <div className={styles.patchNotes}>
            <p className={styles.version}>
              &#128187; PATCH VERSION {patchNotes.version}
            </p>
            {patchNotes.notes.map((note, i) => (
              <p key={i} className={styles.note}>
                &raquo; {note}
              </p>
            ))}
          </div>
        </footer>
      </div>

      <div className={styles.contentPanel}>
        <div className={styles.descriptionArea}>
          <AnimatePresence mode="wait">
            {hoveredItem && (
              <motion.p
                key={hoveredItem}
                className={styles.description}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {getDescription()}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className={styles.systemStatus}>
          <span>SYSTEM STATUS: OPTIMAL</span>
          <span className={styles.statusIcon}>&#8999;</span>
        </div>
      </div>

      <AnimatePresence>
        {showExit && <ExitModal onClose={() => setShowExit(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
