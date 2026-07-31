import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import type { EmailOtpType, Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Shop } from '../types';

/** Where Supabase sends the user back to after they tap the email link. */
export const EMAIL_CONFIRM_REDIRECT = 'measuresone://confirm-email';

/**
 * Turns the deep link Supabase opens the app with into a real session.
 *
 * Which shape the link takes depends on the project's flow type and email
 * template, so all three are handled: implicit (tokens in the URL fragment),
 * PKCE (`?code=`), and the newer hashed-token templates (`?token_hash=&type=`).
 * Returns true if the URL actually carried credentials.
 */
async function completeSessionFromUrl(url: string): Promise<boolean> {
  // Logged without the token values themselves so the Metro console shows
  // which shape the link arrived in when confirmation doesn't take.
  const shape = {
    hasFragment: url.includes('#'),
    hasCode: url.includes('code='),
    hasTokenHash: url.includes('token_hash='),
    hasAccessToken: url.includes('access_token='),
    hasError: url.includes('error'),
  };
  console.log('[auth] deep link received', url.split('?')[0].split('#')[0], shape);

  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const fragment = new URLSearchParams(url.slice(hashIndex + 1));
    const access_token = fragment.get('access_token');
    const refresh_token = fragment.get('refresh_token');
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      return true;
    }
  }

  const { queryParams } = Linking.parse(url);

  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  const tokenHash = queryParams?.token_hash;
  if (typeof tokenHash === 'string') {
    const rawType = queryParams?.type;
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: (typeof rawType === 'string' ? rawType : 'email') as EmailOtpType,
    });
    if (error) throw error;
    return true;
  }

  console.log('[auth] deep link carried no credentials — nothing to exchange');
  return false;
}

/**
 * @react-native-google-signin/google-signin is a native module — it isn't
 * bundled into Expo Go. Its own index.js re-exports GoogleSigninButton,
 * which calls NativeModule.getConstants() at MODULE-EVALUATION time (not
 * inside any function). That means the mere `import ... from
 * '@react-native-google-signin/google-signin'` line — evaluated the instant
 * this file loads — used to crash the entire app in Expo Go with
 * "RNGoogleSignin could not be found", before any screen even rendered.
 *
 * A top-level `import` is always eagerly evaluated by Metro, so delaying
 * *calls* into the module (e.g. wrapping .configure() in a function) doesn't
 * help — the crash happens on import, not on use. The only fix is to never
 * let Metro evaluate that module's code in Expo Go at all, via a runtime
 * `require()` inside a function that's gated behind an Expo Go check.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

function loadGoogleSignIn(): GoogleSigninModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin');
}

let googleSignInConfigured = false;
function ensureGoogleSignInConfigured(GoogleSignin: GoogleSigninModule['GoogleSignin']) {
  if (googleSignInConfigured) return;
  GoogleSignin.configure({
    webClientId: (Constants.expoConfig?.extra?.googleWebClientId as string | undefined) ?? '',
    scopes: ['email', 'profile'],
    offlineAccess: false,
  });
  googleSignInConfigured = true;
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  shop: Shop | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<{ alreadyRegistered: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshShop: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchShop(userId: string): Promise<Shop | null> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  const loadShop = useCallback(async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setShop(null);
      return;
    }
    try {
      const shopData = await fetchShop(currentSession.user.id);
      setShop(shopData);
    } catch {
      // A failed shop lookup should not block the app from rendering —
      // the user simply lands on Shop Setup and can retry there.
      setShop(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession } }) => {
        if (!active) return;
        setSession(initialSession);
        await loadShop(initialSession);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      void loadShop(newSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadShop]);

  // Completes email confirmation when the user taps the link in their inbox,
  // both for a cold start (app was closed) and while it's already running.
  useEffect(() => {
    const handle = (url: string) => {
      void completeSessionFromUrl(url).catch((err) => {
        console.warn('[auth] could not complete confirmation from link:', err?.message ?? err);
      });
    };

    void Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));

    return () => subscription.remove();
  }, []);

  const signUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: EMAIL_CONFIRM_REDIRECT },
    });
    if (error) throw error;

    // With email confirmation on, Supabase deliberately doesn't error for an
    // address that's already registered — it returns a decoy user with an
    // empty `identities` array instead, to avoid leaking who has an account.
    // That empty array is the documented way to detect the collision.
    return { alreadyRegistered: (data.user?.identities?.length ?? 0) === 0 };
  };

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: EMAIL_CONFIRM_REDIRECT },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    if (isExpoGo) {
      throw new Error(
        'Google Sign-In needs a custom dev build — it isn\'t available in Expo Go. Run "npx expo run:android" (or an EAS dev build), or sign in with email instead.'
      );
    }

    const { GoogleSignin, statusCodes } = loadGoogleSignIn();

    try {
      ensureGoogleSignInConfigured(GoogleSignin);

      // Ensure Google Play Services are available (Android only, no-op on iOS)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Show the native Google account picker drawer
      const response = await GoogleSignin.signIn();

      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error('Google Sign-In did not return an ID token. Check your Web Client ID configuration.');
      }

      // Exchange Google ID token with Supabase
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === statusCodes.SIGN_IN_CANCELLED
      ) {
        // User cancelled — do nothing
        return;
      }
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'measuresone://reset-password',
    });
    if (error) throw error;
  };

  const signOut = async () => {
    // Sign out from both Supabase and Google (clears cached Google account).
    // Skipped entirely in Expo Go, where the native module isn't present.
    if (!isExpoGo) {
      try {
        const { GoogleSignin } = loadGoogleSignIn();
        await GoogleSignin.signOut();
      } catch {
        // Not a fatal error if Google sign-out fails
      }
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const refreshShop = async () => {
    await loadShop(session);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        shop,
        loading,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        resetPassword,
        resendConfirmationEmail,
        signOut,
        refreshShop,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * For screens that only render once a shop exists (everything behind MainNavigator).
 * Narrows `shop` to non-null so callers don't need `shop!` everywhere.
 */
export function useShop(): Shop {
  const { shop } = useAuth();
  if (!shop) throw new Error('useShop must be used within a shop-scoped screen');
  return shop;
}
