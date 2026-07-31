import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** One quick-add action, in the order the tour walks through them. */
export const TOUR_STEPS = ['customers', 'billing', 'orders', 'staff'] as const;
export type TourStep = (typeof TOUR_STEPS)[number];

type ProductTourState = {
  /** `null` when idle, `'welcome'` for the intro card, else the highlighted quick-add row. */
  step: TourStep | 'welcome' | null;
  start: () => void;
  next: () => void;
  back: () => void;
  finish: () => void;
};

const ProductTourContext = createContext<ProductTourState | undefined>(undefined);

export function ProductTourProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<TourStep | 'welcome' | null>(null);

  const start = useCallback(() => setStep('welcome'), []);
  const finish = useCallback(() => setStep(null), []);

  const next = useCallback(() => {
    setStep((current) => {
      if (current === null) return null;
      if (current === 'welcome') return TOUR_STEPS[0];
      const index = TOUR_STEPS.indexOf(current);
      return index >= TOUR_STEPS.length - 1 ? null : TOUR_STEPS[index + 1];
    });
  }, []);

  const back = useCallback(() => {
    setStep((current) => {
      if (current === null || current === 'welcome') return current;
      const index = TOUR_STEPS.indexOf(current);
      return index <= 0 ? 'welcome' : TOUR_STEPS[index - 1];
    });
  }, []);

  const value = useMemo(() => ({ step, start, next, back, finish }), [step, start, next, back, finish]);

  return <ProductTourContext.Provider value={value}>{children}</ProductTourContext.Provider>;
}

export function useProductTour() {
  const ctx = useContext(ProductTourContext);
  if (!ctx) throw new Error('useProductTour must be used within a ProductTourProvider');
  return ctx;
}
