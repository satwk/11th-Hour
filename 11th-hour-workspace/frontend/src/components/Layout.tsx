import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutGrid, Keyboard, Sliders, Timer, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { motion } from 'framer-motion';

export const Layout: React.FC = () => {
  const { localScore, googleConnected, apiError } = useApp();
  const location = useLocation();

  const getGlowDetails = (score: number) => {
    if (score < 50) {
      return { color: 'rgba(217, 119, 6, 0.12)', label: 'Exhausted', border: 'border-amber-500/30', bg: 'bg-amber-500' };
    } else if (score >= 75) {
      return { color: 'rgba(94, 106, 210, 0.15)', label: 'Focused', border: 'border-purple-500/30', bg: 'bg-[#5e6ad2]' };
    } else {
      return { color: 'rgba(6, 182, 212, 0.12)', label: 'Balanced', border: 'border-cyan-500/30', bg: 'bg-cyan-400' };
    }
  };

  const glow = getGlowDetails(localScore);

  const links = [
    { to: '/dashboard', label: 'Eisenhower Matrix', icon: LayoutGrid },
    { to: '/dashboard/capture', label: 'Brain Capture', icon: Keyboard },
    { to: '/dashboard/readiness', label: 'Daily Readiness', icon: Sliders },
    { to: '/dashboard/focus', label: 'Focus Space', icon: Timer },
    { to: '/dashboard/sync', label: 'Google Sync', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-[#0c0d0e] text-[#f7f8f8] font-sans selection:bg-[#5e6ad2]/20 flex overflow-hidden h-screen relative">
      {/* Dynamic Ambient Background Glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[140px] pointer-events-none transition-all duration-1000 z-0"
        style={{
          background: `radial-gradient(circle, ${glow.color} 0%, transparent 80%)`
        }}
      />

      {/* Navigation Sidebar */}
      <aside className="w-64 bg-[#0f1011] border-r border-[#222326] flex flex-col h-full z-10 shrink-0 select-none">
        {/* Brand Header */}
        <div className="p-6 border-b border-[#222326] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-7 h-7 bg-[#5e6ad2] rounded-md flex items-center justify-center text-white font-semibold text-sm shadow-md">
              11
            </span>
            <span className="font-semibold text-[#f7f8f8] text-base tracking-tight">11th Hour</span>
          </div>
          {/* Accent dot based on current focus state */}
          <div className="flex items-center" title={`Status: ${glow.label}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${glow.bg} animate-pulse shadow-[0_0_8px_currentColor]`} />
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-[#141516] text-[#f7f8f8] border border-[#222326] shadow-sm'
                    : 'text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-[#141516]/50 border border-transparent'
                }`
              }
            >
              {({ isActive }) => {
                const Icon = link.icon;
                return (
                  <>
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#5e6ad2]' : 'text-[#62666d] group-hover:text-[#8a8f98]'}`} />
                    <span>{link.label}</span>
                  </>
                );
              }}
            </NavLink>
          ))}
        </nav>

        {/* User / Sync Status Panel */}
        <div className="p-4 border-t border-[#222326] bg-[#0c0d0e]/40 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#62666d] uppercase tracking-wider font-semibold font-mono">
              Google Integration
            </span>
            <span className={`flex items-center text-[10px] font-mono px-2 py-0.5 rounded border ${
              googleConnected 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-[#141516] text-[#8a8f98] border-[#222326]'
            }`}>
              {googleConnected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-[#141516] border border-[#222326] flex items-center justify-center text-[10px] font-semibold text-[#8a8f98] font-mono">
              TU
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#f7f8f8] truncate">testuser@example.com</p>
              <p className="text-[9px] text-[#62666d] truncate font-mono">Active Workspace</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 border border-[#5e6ad2]/40 shadow-[0_0_15px_rgba(94,106,210,0.4),0_0_50px_rgba(94,106,210,0.15)]">
        {/* Connection/API Errors Header Banner */}
        {apiError && (
          <div className="p-3.5 bg-rose-950/20 border-b border-rose-500/20 text-rose-400 text-xs flex items-center justify-between animate-fade-in relative z-20">
            <div className="flex items-center space-x-2">
              <span className="font-semibold font-mono uppercase text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                Alert
              </span>
              <span>{apiError}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 relative">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full h-full"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
};
