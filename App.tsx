import './global.css';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  GoogleSansFlex_400Regular,
  GoogleSansFlex_500Medium,
  GoogleSansFlex_600SemiBold,
  GoogleSansFlex_700Bold,
} from '@expo-google-fonts/google-sans-flex';
import { LoadingSpinner, ToastProvider } from './components/ui';
import { AuthProvider } from './context/AuthContext';
import { RootNavigator } from './navigation/RootNavigator';
import { initI18n } from './lib/i18n';

/**
 * Paints the status bar strip white to match the app's white screens. Sits
 * above the navigator and ignores touches so it never blocks anything
 * underneath.
 */
function StatusBarBackdrop() {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: insets.top,
        backgroundColor: '#FFFFFF',
        zIndex: 999,
      }}
    />
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    GoogleSansFlex_400Regular,
    GoogleSansFlex_500Medium,
    GoogleSansFlex_600SemiBold,
    GoogleSansFlex_700Bold,
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    void initI18n().finally(() => setI18nReady(true));
  }, []);

  // Render anyway if the fonts fail — falling back to the system font beats
  // showing a blank screen forever.
  if ((!fontsLoaded && !fontError) || !i18nReady) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ToastProvider>
      <StatusBarBackdrop />
      {/* Dark icons, since the strip behind them is now white. */}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
