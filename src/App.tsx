import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { SystemJunk } from './pages/SystemJunk';
import { Uninstaller } from './pages/Uninstaller';
import { Updater } from './pages/Updater';
import { Shredder } from './pages/Shredder';
import { MailCleaner } from './pages/MailCleaner';
import { Extensions } from './pages/Extensions';
import { LargeFiles } from './pages/LargeFiles';
import { SpaceLens } from './pages/SpaceLens';
import { MalwareAndPrivacy } from './pages/Malware';
import { Optimization } from './pages/Optimization';
import { Assistant } from './pages/Assistant';
import { Settings } from './pages/Settings';
import { TrashBins } from './pages/TrashBins';
import { Privacy } from './pages/Privacy';
import { Maintenance } from './pages/Maintenance';
import { Help } from './pages/Help';
import { useScanStore } from './store/scanStore';

import { Onboarding } from './pages/Onboarding';
import { MenuApp } from './pages/MenuApp';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { aiService } from './services/aiService';

import { NotificationManager } from './components/NotificationManager';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [setupComplete, setSetupComplete] = useState(() => {
    return localStorage.getItem('mac_cleaner_setup_complete') === 'true';
  });
  const [isMenuWindow, setIsMenuWindow] = useState(false);

  const { fetchSystemStats, fetchAppStats } = useScanStore();

  useEffect(() => {
    // Initial fetch
    fetchSystemStats();
    fetchAppStats();

    // Poll every 5 seconds
    const interval = setInterval(() => {
      fetchSystemStats();
    }, 5000);

    // Monitor Loop

    // Proactive Monitor Loop
    const monitorInterval = setInterval(() => {
      const { systemStats, junkResult } = useScanStore.getState();
      const lastAlert = parseInt(localStorage.getItem('alto_last_alert_time') || '0');
      const now = Date.now();
      const COOLDOWN = 5 * 60 * 1000; // 5 minutes

      if (now - lastAlert < COOLDOWN) return;

      if (systemStats && systemStats.cpu_load > 80) {

        aiService.generateProactiveAlert('high_cpu', { cpu: systemStats.cpu_load });
        localStorage.setItem('alto_last_alert_time', now.toString());
        return;
      }

      const junkSize = junkResult?.total_size_bytes || 0;
      if (junkSize > 1024 * 1024 * 1024) { // 1GB

        aiService.generateProactiveAlert('high_junk', { junkSize });
        localStorage.setItem('alto_last_alert_time', now.toString());
        return;
      }

    }, 10000); // Check every 10 seconds

    return () => {
      clearInterval(interval);
      clearInterval(monitorInterval);
    };
  }, []);

  useEffect(() => {
    // Check if we are the 'menu' window
    const checkWindow = async () => {
      const win = getCurrentWindow();
      if (win.label === 'menu') {
        setIsMenuWindow(true);
        document.documentElement.classList.add('bg-transparent'); // Ensure html is transparent
      }
    };
    checkWindow();
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('mac_cleaner_setup_complete', 'true');
    setSetupComplete(true);
  };

  if (isMenuWindow) {
    return <MenuApp />;
  }

  if (!setupComplete) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'assistant':
        return <Assistant onNavigate={setActiveTab} />;
      case 'system-junk':
        return <SystemJunk />;
      case 'uninstaller':
        return <Uninstaller onNavigate={setActiveTab} />;
      case 'updater':
        return <Updater />;
      case 'shredder':
        return <Shredder />;
      case 'mail':
        return <MailCleaner />;
      case 'extensions':
        return <Extensions />;
      case 'large-files':
        return <LargeFiles />;
      case 'space-lens':
        return <SpaceLens />;
      case 'malware':
        return <MalwareAndPrivacy />;
      case 'privacy':
        return <Privacy />;
      case 'trash-bins':
        return <TrashBins />;
      case 'optimization':
        return <Optimization />;
      case 'maintenance':
        return <Maintenance />;
      case 'settings':
        return <Settings />;
      case 'help':
        return <Help />;
      default:
        return <div className="p-10 text-center"><h2 className="text-2xl font-bold mb-2">Not Found</h2><p className="text-muted-foreground">Page not found.</p></div>;
    }
  };

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <NotificationManager />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="h-full"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </AppLayout>
  );
}

export default App;
