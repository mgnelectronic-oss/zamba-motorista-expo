import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, AppState, type AppStateStatus } from 'react-native';
import { darkPalette, lightPalette } from '@/theme/palettes';
import type { ResolvedTheme, ThemeColors, ThemePreference } from '@/theme/types';

const STORAGE_KEY = '@zamba_driver_theme_preference';

type AppThemeContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
  resolved: ResolvedTheme;
  colors: ThemeColors;
  isHydrated: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function resolveTheme(preference: ThemePreference, system: 'light' | 'dark' | null | undefined): ResolvedTheme {
  if (preference === 'system') {
    return system === 'dark' ? 'dark' : 'light';
  }
  return preference;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (raw === 'light' || raw === 'dark' || raw === 'system')) {
          setPreferenceState(raw);
        }
      } catch {
        /* manter default */
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** `Appearance` pode não atualizar o hook em todos os casos — reforçar ao voltar à app. */
  const [systemSnapshot, setSystemSnapshot] = useState<'light' | 'dark'>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemSnapshot(colorScheme === 'dark' ? 'dark' : 'light');
    });
    const onAppState = (s: AppStateStatus) => {
      if (s === 'active') {
        const cs = Appearance.getColorScheme();
        setSystemSnapshot(cs === 'dark' ? 'dark' : 'light');
      }
    };
    const appSub = AppState.addEventListener('change', onAppState);
    return () => {
      sub.remove();
      appSub.remove();
    };
  }, []);

  const resolved = useMemo(
    () => resolveTheme(preference, systemSnapshot),
    [preference, systemSnapshot],
  );

  const colors = resolved === 'dark' ? darkPalette : lightPalette;

  const setPreference = useCallback(async (p: ThemePreference) => {
    setPreferenceState(p);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* persistência falhou — UI já atualizou */
    }
  }, []);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      preference,
      setPreference,
      resolved,
      colors,
      isHydrated,
    }),
    [preference, setPreference, resolved, colors, isHydrated],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return ctx;
}

/** Para ecrãs fora do provider (não deve acontecer) — fallback claro. */
export function useAppThemeOptional(): AppThemeContextValue | null {
  return useContext(AppThemeContext);
}
