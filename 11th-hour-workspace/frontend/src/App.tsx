import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { CapturePage } from './pages/CapturePage';
import { ReadinessPage } from './pages/ReadinessPage';
import { FocusPage } from './pages/FocusPage';
import { SyncPage } from './pages/SyncPage';
import { LandingPage } from './pages/LandingPage';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Main Layout containing sidebar under dashboard */}
          <Route path="/dashboard" element={<Layout />}>
            {/* Dashboard shows matrix board */}
            <Route index element={<DashboardPage />} />
            
            {/* Capture shows Brain Dump */}
            <Route path="capture" element={<CapturePage />} />
            
            {/* Readiness shows logger */}
            <Route path="readiness" element={<ReadinessPage />} />
            
            {/* Focus shows distraction-free focus workspace */}
            <Route path="focus" element={<FocusPage />} />
            
            {/* Sync page manages Calendar configurations */}
            <Route path="sync" element={<SyncPage />} />
          </Route>

          {/* Default fallback redirects to Landing Page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
