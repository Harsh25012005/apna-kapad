import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppGuide } from '../components/AppGuide';
import { useShop } from './AuthContext';
import { hasSeenAppGuide, markAppGuideSeen } from '../lib/appGuide';

type AppGuideContextValue = {
  openGuide: () => void;
};

const AppGuideContext = createContext<AppGuideContextValue | null>(null);

/**
 * Renders the AppGuide modal and shows it automatically the first time a
 * shop's owner reaches the main app. Also exposes openGuide() so screens
 * (e.g. Settings) can let the user replay it on demand.
 */
export function AppGuideProvider({ children }: { children: ReactNode }) {
  const shop = useShop();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void hasSeenAppGuide(shop.id).then((seen) => {
      if (active && !seen) setVisible(true);
    });
    return () => {
      active = false;
    };
  }, [shop.id]);

  const dismiss = () => {
    setVisible(false);
    void markAppGuideSeen(shop.id);
  };

  return (
    <AppGuideContext.Provider value={{ openGuide: () => setVisible(true) }}>
      {children}
      <AppGuide visible={visible} onDone={dismiss} />
    </AppGuideContext.Provider>
  );
}

export function useAppGuide(): AppGuideContextValue {
  const ctx = useContext(AppGuideContext);
  if (!ctx) throw new Error('useAppGuide must be used within AppGuideProvider');
  return ctx;
}
