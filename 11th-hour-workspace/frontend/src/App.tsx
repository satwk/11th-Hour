import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { CapturePage } from './pages/CapturePage';
import { ReadinessPage } from './pages/ReadinessPage';
import { FocusPage } from './pages/FocusPage';
import { SyncPage } from './pages/SyncPage';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Main Layout containing sidebar */}
          <Route path="/" element={<Layout />}>
            {/* Dashboard shows matrix board */}
            <Route path="dashboard" element={<DashboardPage />} />
            
            {/* Capture shows Brain Dump */}
            <Route path="capture" element={<CapturePage />} />
            
            {/* Readiness shows logger */}
            <Route path="readiness" element={<ReadinessPage />} />
            
            {/* Focus shows distraction-free focus workspace */}
            <Route path="focus" element={<FocusPage />} />
            
            {/* Sync page manages Calendar configurations */}
            <Route path="sync" element={<SyncPage />} />
            
            {/* Default fallback redirects to dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
