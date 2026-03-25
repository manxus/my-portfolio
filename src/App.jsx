import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { useSettingsStore } from './stores/settingsStore';
import { useAdminStore } from './stores/adminStore';
import BootSequence from './components/BootSequence/BootSequence';
import MainMenu from './components/MainMenu/MainMenu';
import PageShell from './components/PageShell/PageShell';
import CrtOverlay from './components/CrtOverlay/CrtOverlay';
import VisionFilters from './components/VisionFilters/VisionFilters';
import QAPortfolio from './pages/QAPortfolio';
import SteamLibrary from './pages/SteamLibrary';
import Resume from './pages/Resume';
import SideProjects from './pages/SideProjects';
import Tech from './pages/Tech';
import Media from './pages/Media';
import Livestream from './pages/Livestream';
import Settings from './pages/Settings';
import Credits from './pages/Credits';
import PatchNotes from './pages/PatchNotes';
import LoginModal from './admin/LoginModal';
import AdminToolbar from './admin/AdminToolbar';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useSettingsApplier } from './hooks/useSettingsApplier';

const pageRoutes = [
  { path: '/qa-portfolio', title: 'QA Portfolio', subtitle: 'STORY // CHAPTER 01', Component: QAPortfolio },
  { path: '/steam-library', title: 'Steam Library', subtitle: 'STORY // CHAPTER 02', Component: SteamLibrary },
  { path: '/resume', title: 'Resume', subtitle: 'DLCS // DOWNLOAD 01', Component: Resume },
  { path: '/side-projects', title: 'Side Projects', subtitle: 'DLCS // DOWNLOAD 02', Component: SideProjects },
  { path: '/tech', title: 'Tech Loadout', subtitle: 'STORY // CHAPTER 03', Component: Tech },
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
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const verifyToken = useAdminStore((s) => s.verifyToken);
  const [showLogin, setShowLogin] = useState(false);

  const handleAdminTrigger = useCallback(() => {
    if (isAuthenticated) return;
    setShowLogin(true);
  }, [isAuthenticated]);

  useEffect(() => {
    if (import.meta.env.DEV && isAuthenticated) {
      verifyToken();
    }
  }, []);

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
        <MainMenu
          desktopContent={desktopContent}
          onAdminTrigger={import.meta.env.DEV ? handleAdminTrigger : undefined}
        />
      )}

      {bootComplete && !isDesktop && (
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <MainMenu
                  onAdminTrigger={import.meta.env.DEV ? handleAdminTrigger : undefined}
                />
              }
            />
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
      {import.meta.env.DEV && (
        <>
          <AnimatePresence>
            {showLogin && !isAuthenticated && (
              <LoginModal onClose={() => setShowLogin(false)} />
            )}
          </AnimatePresence>
          {isAuthenticated && <AdminToolbar />}
        </>
      )}
    </MotionConfig>
  );
}
