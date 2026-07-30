import './global.css';
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

/**
 * Paints the status bar strip black. Screens are white, so without this the
 * clock/battery row reads as a bright band above the app. Sits above the
 * navigator and ignores touches so it never blocks anything underneath.
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
        backgroundColor: '#050505',
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

  // Render anyway if the fonts fail — falling back to the system font beats
  // showing a blank screen forever.
  if (!fontsLoaded && !fontError) {
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
      {/* Light icons, since the strip behind them is now black. */}
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
