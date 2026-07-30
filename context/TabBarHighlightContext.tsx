import { createContext, useContext, useState, type ReactNode } from 'react';
import type { MainTabParamList } from '../navigation/types';

type HighlightedTab = keyof MainTabParamList | null;

type TabBarHighlightContextValue = {
  highlightedTab: HighlightedTab;
  setHighlightedTab: (tab: HighlightedTab) => void;
  tabBarHeight: number;
  setTabBarHeight: (height: number) => void;
};

const TabBarHighlightContext = createContext<TabBarHighlightContextValue | null>(null);

/**
 * Lets the AppGuide coachmark overlay point at a specific icon in the real
 * (custom) bottom tab bar, and lets the overlay know the bar's measured
 * height so it can leave that strip of screen uncovered.
 */
export function TabBarHighlightProvider({ children }: { children: ReactNode }) {
  const [highlightedTab, setHighlightedTab] = useState<HighlightedTab>(null);
  const [tabBarHeight, setTabBarHeight] = useState(0);

  return (
    <TabBarHighlightContext.Provider
      value={{ highlightedTab, setHighlightedTab, tabBarHeight, setTabBarHeight }}
    >
      {children}
    </TabBarHighlightContext.Provider>
  );
}

export function useTabBarHighlight(): TabBarHighlightContextValue {
  const ctx = useContext(TabBarHighlightContext);
  if (!ctx) throw new Error('useTabBarHighlight must be used within TabBarHighlightProvider');
  return ctx;
}
