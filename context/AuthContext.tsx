import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Shop } from '../types';

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  shop: Shop | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
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

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    // No `scheme` override here: in Expo Go this resolves to the running
    // exp://<lan-ip>:<port> URL (which Expo Go can actually receive), and in
    // a dev/standalone build it resolves to the native `apnakapad://` scheme
    // from app.config.js. Hardcoding scheme: 'apnakapad' breaks Expo Go,
    // since Expo Go can't be deep-linked via a custom scheme — Supabase would
    // then fall back to the dashboard's Site URL (localhost:3000) because the
    // requested redirect wasn't on the allow list.
    const redirectTo = AuthSession.makeRedirectUri();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('Could not start Google sign-in');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) return;

    const fragment = result.url.split('#')[1] ?? result.url.split('?')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (sessionError) throw sessionError;
    }
  };

  const resetPassword = async (email: string) => {
    const redirectTo = AuthSession.makeRedirectUri();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  };

  const signOut = async () => {
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
