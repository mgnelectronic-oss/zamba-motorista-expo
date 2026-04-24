export type ThemePreference = 'light' | 'dark' | 'system';

export type ResolvedTheme = 'light' | 'dark';

/**
 * Tokens semânticos partilhados — light e dark preenchem os mesmos campos.
 */
export interface ThemeColors {
  bg: string;
  bgMuted: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  accent: string;
  accentDark: string;
  accentMuted: string;
  onAccent: string;
  danger: string;
  dangerMuted: string;
  success: string;
  successBg: string;
  info: string;
  infoBg: string;
  warning: string;
  warningBg: string;
  overlay: string;
  modalBg: string;
  inputBg: string;
  inputBorder: string;
  chipBg: string;
  chipBgActive: string;
  secondaryBtnBg: string;
  secondaryBtnText: string;
  /** Carteira / saldo — cartão principal */
  walletCardBg: string;
  walletCardBgEnd: string;
  /** Tab bar */
  tabBarBg: string;
  tabBarBorder: string;
  tabInactive: string;
  tabActiveBg: string;
  tabActiveLabel: string;
  refreshTint: string;
  /** React Native / Expo StatusBar */
  statusBarStyle: 'light' | 'dark';
  /** Botão escuro neutro (ex.: Guardar dados) */
  buttonMutedStrong: string;
  /** Sobrepor listas em loading (viagens) */
  listLoadingScrim: string;
  /**
   * Carteira (Saldo) + modal Detalhes da Viagem — não usar fora destes ecrãs.
   * Permite contraste premium no escuro sem alterar o resto da app.
   */
  walletUiInfoBg: string;
  walletUiInfoBorder: string;
  walletUiInfoIconBg: string;
  walletUiInfoTitle: string;
  walletUiInfoBody: string;
  walletUiTabTrack: string;
  walletUiTabPill: string;
  tripDetailRouteLine: string;
}
