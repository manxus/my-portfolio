import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { useSettingsStore } from './stores/settingsStore';
import BootSequence from './components/BootSequence/BootSequence';
import MainMenu from './components/MainMenu/MainMenu';
import PageShell from './components/PageShell/PageShell';
import CrtOverlay from './components/CrtOverlay/CrtOverlay';
import VisionFilters from './components/VisionFilters/VisionFilters';
import QAPortfolio from './pages/QAPortfolio';
import SteamLibrary from './pages/SteamLibrary';
import Resume from './pages/Resume';
import References from './pages/References';
import Tech from './pages/Tech';
import Media from './pages/Media';
import Livestream from './pages/Livestream';
import Settings from './pages/Settings';
import Credits from './pages/Credits';
import PatchNotes from './pages/PatchNotes';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useSettingsApplier } from './hooks/useSettingsApplier';

const pageRoutes = [
  { path: '/qa-portfolio', title: 'QA Portfolio', subtitle: 'STORY // CHAPTER 01', Component: QAPortfolio },
  { path: '/steam-library', title: 'Steam Library', subtitle: 'STORY // CHAPTER 02', Component: SteamLibrary },
  { path: '/resume', title: 'Resume', subtitle: 'DLCS // DOWNLOAD 01', Component: Resume },
  { path: '/references', title: 'References', subtitle: 'DLCS // DOWNLOAD 02', Component: References },
  { path: '/tech', title: 'Tech', subtitle: 'EXTRA // BONUS CONTENT', Component: Tech },
  { path: '/media', title: 'Media', subtitle: 'EXTRA // BONUS CONTENT', Component: Media },
  { path: '/livestream', title: 'Livestream', subtitle: 'EXTRA // BONUS CONTENT', Component: Livestream },
  { path: '/settings', title: 'Settings', subtitle: 'SYSTEM CONFIGURATION', Component: Settings },
  { path: '/credits', title: 'Credits', subtitle: 'ACKNOWLEDGMENTS', Component: Credits },
  { path: '/patch-notes', title: 'Patch Notes', subtitle: 'VERSION HISTORY // CHANGELOG', Component: PatchNotes },
];

export default function App() {
  useSettingsApplier();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1200px)');
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const [bootComplete, setBootComplete] = useState(() => {
    if (location.pathname !== '/') return true;
    return sessionStorage.getItem('bv_boot') === 'done';
  });

  const handleBootComplete = () => {
    sessionStorage.setItem('bv_boot', 'done');
    setBootComplete(true);
  };

  const hasPage = location.pathname !== '/';

  const desktopContent = hasPage ? (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {pageRoutes.map(({ path, title, subtitle, Component }) => (
          <Route
            key={path}
            path={path}
            element={
              <PageShell title={title} subtitle={subtitle} inline>
                <Component />
              </PageShell>
            }
          />
        ))}
      </Routes>
    </AnimatePresence>
  ) : null;

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <VisionFilters />
      <CrtOverlay />

      <AnimatePresence>
        {!bootComplete && (
          <BootSequence key="boot" onComplete={handleBootComplete} />
        )}
      </AnimatePresence>

      {bootComplete && isDesktop && (
        <MainMenu desktopContent={desktopContent} />
      )}

      {bootComplete && !isDesktop && (
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<MainMenu />} />
            {pageRoutes.map(({ path, title, subtitle, Component }) => (
              <Route
                key={path}
                path={path}
                element={
                  <PageShell title={title} subtitle={subtitle}>
                    <Component />
                  </PageShell>
                }
              />
            ))}
          </Routes>
        </AnimatePresence>
      )}
    </MotionConfig>
  );
}
