import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { ConfirmHost, Layout, Toasts } from './components/Layout';
import { useProfile, useSettings } from './hooks/data';
import { ensureSeed } from './data/profileRepo';
import { setUsdaKeyProvider } from './data/foodProviders';
import { Onboarding } from './pages/Onboarding';
import { Today } from './pages/Today';
import { Nutrition } from './pages/Nutrition';
import { Training } from './pages/Training';
import { PlanEditor } from './pages/PlanEditor';
import { LiveWorkout } from './pages/LiveWorkout';
import { WorkoutDetail, ExerciseDetail } from './pages/TrainingDetails';
import { Body } from './pages/Body';
import { Stats } from './pages/Stats';
import { Coach } from './pages/Coach';
import { SettingsPage } from './pages/Settings';
import { Achievements } from './pages/Achievements';
import { CelebrationHost, GameWatcher } from './components/Celebration';
import { BootScreen } from './components/Boot';

function useTheme() {
  const { theme, hero } = useSettings();
  const palette = hero?.palette && hero.palette !== 'imperium' ? hero.palette : '';
  useEffect(() => {
    if (palette) document.documentElement.dataset.palette = palette;
    else delete document.documentElement.dataset.palette;
  }, [palette]);
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    try {
      localStorage.setItem('fitcore-theme', theme);
    } catch {
      /* ignorieren */
    }
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function App() {
  const profile = useProfile();
  const settings = useSettings();
  useTheme();
  useEffect(() => {
    // Übungsbibliothek im Hintergrund aktualisieren – blockiert den Start nicht.
    ensureSeed().catch((e) => console.error('Seed fehlgeschlagen', e));
  }, []);
  useEffect(() => {
    setUsdaKeyProvider(() => settings.usdaApiKey || ((import.meta.env.VITE_USDA_API_KEY as string | undefined) ?? ''));
  }, [settings.usdaApiKey]);

  if (profile === undefined) return <BootScreen />;
  if (profile === null)
    return (
      <>
        <Onboarding />
        <Toasts />
        <ConfirmHost />
      </>
    );
  return (
    <HashRouter>
      <Toasts />
      <ConfirmHost />
      <CelebrationHost />
      <GameWatcher />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="nutrition" element={<Nutrition />} />
          <Route path="training" element={<Training />} />
          <Route path="training/plan/:id" element={<PlanEditor />} />
          <Route path="training/workout" element={<LiveWorkout />} />
          <Route path="training/history/:id" element={<WorkoutDetail />} />
          <Route path="training/exercise/:id" element={<ExerciseDetail />} />
          <Route path="body" element={<Body />} />
          <Route path="stats" element={<Stats />} />
          <Route path="coach" element={<Coach />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="erfolge" element={<Achievements />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
