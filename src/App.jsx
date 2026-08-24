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
import Music from './pages/Music';
import Books from './pages/Books';
import Tabletop from './pages/Tabletop';
import Cinema from './pages/Cinema';
import TravelLog from './pages/TravelLog';
import Games from './pages/Games';
import Settings from './pages/Settings';
import Credits from './pages/Credits';
import PatchNotes from './pages/PatchNotes';
import CardContactShell from './pages/CardContactShell';
import LoginModal from './admin/LoginModal';
import AdminToolbar from './admin/AdminToolbar';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useSettingsApplier } from './hooks/useSettingsApplier';
import { useVisitorTracking, trackBootComplete } from './hooks/useVisitorTracking';
import UnlockToast from './components/VisitorMedals/UnlockToast';
import VisitorMedalsDrawer from './components/VisitorMedals/VisitorMedalsDrawer';
import { useVisitorStore } from './stores/visitorStore';

const pageRoutes = [
  { path: '/qa-portfolio', title: 'QA Portfolio', subtitle: 'STORY // CHAPTER 01', Component: QAPortfolio },
  { path: '/steam-library', title: 'Steam Library', subtitle: 'STORY // CHAPTER 02', Component: SteamLibrary },
  { path: '/resume', title: 'Resume', subtitle: 'DLCS // DOWNLOAD 01', Component: Resume },
  { path: '/side-projects', title: 'Projects', subtitle: 'DLCS // DOWNLOAD 02', Component: SideProjects },
  { path: '/games', title: 'Games', subtitle: 'DLCS // DOWNLOAD 03', Component: Games },
  { path: '/tech', title: 'Tech Loadout', subtitle: 'STORY // CHAPTER 03', Component: Tech },
  { path: '/media', title: 'Media', subtitle: 'EXTRA // REPLAY VAULT', Component: Media },
  { path: '/livestream', title: 'Livestream', subtitle: 'EXTRA // BONUS CONTENT', Component: Livestream },
  { path: '/music', title: 'Music', subtitle: 'EXTRA // ON REPEAT', Component: Music },
  { path: '/books', title: 'Library', subtitle: 'EXTRA // CODEX', Component: Books },
  { path: '/tabletop', title: 'Tabletop', subtitle: 'EXTRA // TABLETOP', Component: Tabletop },
  { path: '/cinema', title: 'Cinema', subtitle: 'EXTRA // SCREENING ROOM', Component: Cinema },
  { path: '/travel-log', title: 'Journey', subtitle: 'EXTRA // WORLD MAP', Component: TravelLog },
  { path: '/settings', title: 'Settings', subtitle: 'SYSTEM CONFIGURATION', Component: Settings },
  { path: '/credits', title: 'Credits', subtitle: 'ACKNOWLEDGMENTS', Component: Credits },
  { path: '/patch-notes', title: 'Patch Notes', subtitle: 'VERSION HISTORY // CHANGELOG', Component: PatchNotes },
];

export default function App() {
  useSettingsApplier();
  useVisitorTracking();
  const location = useLocation();
  const drawerOpen = useVisitorStore((s) => s.drawerOpen);
  const setDrawerOpen = useVisitorStore((s) => s.setDrawerOpen);
  const isDesktop = useMediaQuery('(min-width: 1200px)');
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const verifyToken = useAdminStore((s) => s.verifyToken);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('bv_boot') === 'done') {
      trackBootComplete();
    }
  }, []);

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
    trackBootComplete();
    setBootComplete(true);
  };

  const hasPage = location.pathname !== '/';

  const desktopContent = hasPage ? (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/card" element={<CardContactShell inline />} />
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
            <Route path="/card" element={<CardContactShell />} />
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

      <UnlockToast />
      <AnimatePresence>
        {drawerOpen && (
          <VisitorMedalsDrawer onClose={() => setDrawerOpen(false)} />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
