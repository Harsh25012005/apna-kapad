import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info';

const TYPE_STYLES: Record<
  ToastType,
  { bg: string; icon: React.ComponentProps<typeof FontAwesome5>['name'] }
> = {
  success: { bg: '#16A34A', icon: 'check-circle' },
  error: { bg: '#DC2626', icon: 'times-circle' },
  info: { bg: '#0891B2', icon: 'info-circle' },
};

type ShowToast = (message: string, type?: ToastType, duration?: number) => void;

type ToastState = { message: string; type: ToastType; key: number };

const ToastContext = createContext<ShowToast>(() => {});

/**
 * Wrap the app root with this once (see App.tsx).
 *
 * Uses React Native's Animated rather than Reanimated layout animations —
 * Reanimated worklets segfault inside Expo Go on SDK 57.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counterRef = useRef(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const insets = useSafeAreaInsets();

  const showToast = useCallback<ShowToast>(
    (message, type = 'info', duration = 2500) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      counterRef.current += 1;
      setToast({ message, type, key: counterRef.current });

      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -12, duration: 150, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (finished) setToast(null);
        });
      }, duration);
    },
    [opacity, translateY]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast ? (
        <Animated.View
          style={{ top: insets.top + 8, opacity, transform: [{ translateY }] }}
          className="absolute left-4 right-4 z-50 flex-row items-center rounded-md px-4 py-3"
        >
          <View
            className="absolute inset-0 rounded-md"
            style={{ backgroundColor: TYPE_STYLES[toast.type].bg, opacity: 0.95 }}
          />
          <FontAwesome5 name={TYPE_STYLES[toast.type].icon} size={16} color="#FFFFFF" />
          <Text className="ml-2 flex-1 text-sm font-medium text-white">{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

/** Returns showToast(message, type?, duration?) */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}
