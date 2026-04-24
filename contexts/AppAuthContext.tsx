import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';
import { authService } from '@/services/authService';
import { driverService } from '@/services/driverService';
import type { DriverProfile } from '@/types/driver';

/** Referência mínima à corrida ativa — alinhado ao uso em `AppContext.tsx` (web). */
export type ActiveRideRef = { id: string };

interface AppAuthState {
  isLoadingApp: boolean;
  session: Session | null;
  userProfile: DriverProfile | null;
  activeRide: ActiveRideRef | null;
}

interface AppAuthContextValue extends AppAuthState {
  refreshState: (silent?: boolean) => Promise<void>;
}

const AppAuthContext = createContext<AppAuthContextValue | undefined>(undefined);

export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppAuthState>({
    isLoadingApp: true,
    session: null,
    userProfile: null,
    activeRide: null,
  });

  const appStateRef = useRef(AppState.currentState);

  const initializeApp = useCallback(async (silent = false) => {
    if (!isSupabaseConfigured) {
      setState({
        isLoadingApp: false,
        session: null,
        userProfile: null,
        activeRide: null,
      });
      return;
    }

    if (!silent) {
      setState((s) => ({ ...s, isLoadingApp: true }));
    }

    let session: Session | null = null;
    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      // Log de diagnóstico: sessão após leitura do storage; remover ou limitar a __DEV__ em produção
      // eslint-disable-next-line no-console
      console.log('SESSION:', currentSession);

      if (sessionError) {
        if (__DEV__) {
          console.warn('[AppAuth] getSession error (sem signOut automático):', sessionError.message);
        }
        session = null;
      } else {
        session = currentSession;
      }
    } catch (err) {
      if (__DEV__) console.warn('[AppAuth] getSession:', err);
    }

    if (!session) {
      setState({
        isLoadingApp: false,
        session: null,
        userProfile: null,
        activeRide: null,
      });
      return;
    }

    try {
      await authService.ensureDriverSetup(session.user.id);
    } catch (e) {
      if (__DEV__) console.warn('[AppAuth] ensureDriverSetup:', e);
    }

    let profile: DriverProfile | null = null;
    try {
      profile = await driverService.getProfile(session.user.id);
    } catch (err) {
      if (__DEV__) console.warn('[AppAuth] getProfile:', err);
    }

    let activeRide: ActiveRideRef | null = null;
    if (profile) {
      try {
        const ride = await driverService.getActiveRide(profile.id, session.user.id);
        if (ride) activeRide = { id: ride.id };
      } catch (err) {
        if (__DEV__) console.warn('[AppAuth] getActiveRide:', err);
      }
    }

    if (profile) {
      try {
        await driverService.getWallet(session.user.id);
      } catch {
        /* diagnóstico / carteira — não bloquear arranque */
      }
    }

    setState({
      isLoadingApp: false,
      session,
      userProfile: profile,
      activeRide,
    });

    /**
     * Só forçar navegação para a corrida ativa no arranque / refresh completo (`silent === false`).
     * Com `silent === true` (ex.: app volta do background) um `router.replace` aqui remontava
     * `driver/active` em loop: loading inicial, fetch, mapa, ao voltar à app repetia → "A carregar corrida…".
     */
    if (activeRide && !silent) {
      router.replace({ pathname: '/driver/active', params: { ride_id: activeRide.id } } as never);
    }
  }, []);

  useEffect(() => {
    void initializeApp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (__DEV__) console.log('[AppAuth] Auth event:', event);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void initializeApp();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setState((prev) => ({ ...prev, session }));
      }
    });

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        void initializeApp(true);
      }
      appStateRef.current = next;
    });

    return () => {
      subscription.unsubscribe();
      sub.remove();
    };
  }, [initializeApp]);

  const value = useMemo<AppAuthContextValue>(
    () => ({
      ...state,
      refreshState: initializeApp,
    }),
    [state, initializeApp],
  );

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export function useAppAuth(): AppAuthContextValue {
  const ctx = useContext(AppAuthContext);
  if (!ctx) throw new Error('useAppAuth must be used within AppAuthProvider');
  return ctx;
}
