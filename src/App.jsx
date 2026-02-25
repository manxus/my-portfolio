import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import BootSequence from './components/BootSequence/BootSequence';
import MainMenu from './components/MainMenu/MainMenu';
import PageShell from './components/PageShell/PageShell';
import QAPortfolio from './pages/QAPortfolio';
import SteamLibrary from './pages/SteamLibrary';
import Resume from './pages/Resume';
import References from './pages/References';
import Tech from './pages/Tech';
import Media from './pages/Media';
import Livestream from './pages/Livestream';
import Settings from './pages/Settings';
import Credits from './pages/Credits';

export default function App() {
  const location = useLocation();
  const [bootComplete, setBootComplete] = useState(() => {
    if (location.pathname !== '/') return true;
    return sessionStorage.getItem('bv_boot') === 'done';
  });

  const handleBootComplete = () => {
    sessionStorage.setItem('bv_boot', 'done');
    setBootComplete(true);
  };

  return (
    <>
      <AnimatePresence>
        {!bootComplete && (
          <BootSequence key="boot" onComplete={handleBootComplete} />
        )}
      </AnimatePresence>

      {bootComplete && (
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<MainMenu />} />
            <Route
              path="/qa-portfolio"
              element={
                <PageShell title="QA Portfolio" subtitle="STORY // CHAPTER 01">
                  <QAPortfolio />
                </PageShell>
              }
            />
            <Route
              path="/steam-library"
              element={
                <PageShell title="Steam Library" subtitle="STORY // CHAPTER 02">
                  <SteamLibrary />
                </PageShell>
              }
            />
            <Route
              path="/resume"
              element={
                <PageShell title="Resume" subtitle="DLCS // DOWNLOAD 01">
                  <Resume />
                </PageShell>
              }
            />
            <Route
              path="/references"
              element={
                <PageShell title="References" subtitle="DLCS // DOWNLOAD 02">
                  <References />
                </PageShell>
              }
            />
            <Route
              path="/tech"
              element={
                <PageShell title="Tech" subtitle="EXTRA // BONUS CONTENT">
                  <Tech />
                </PageShell>
              }
            />
            <Route
              path="/media"
              element={
                <PageShell title="Media" subtitle="EXTRA // BONUS CONTENT">
                  <Media />
                </PageShell>
              }
            />
            <Route
              path="/livestream"
              element={
                <PageShell title="Livestream" subtitle="EXTRA // BONUS CONTENT">
                  <Livestream />
                </PageShell>
              }
            />
            <Route
              path="/settings"
              element={
                <PageShell title="Settings" subtitle="SYSTEM CONFIGURATION">
                  <Settings />
                </PageShell>
              }
            />
            <Route
              path="/credits"
              element={
                <PageShell title="Credits" subtitle="ACKNOWLEDGMENTS">
                  <Credits />
                </PageShell>
              }
            />
          </Routes>
        </AnimatePresence>
      )}
    </>
  );
}
