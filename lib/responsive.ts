import { Dimensions } from 'react-native';

/** Largura de referência (iPhone clássico) para escala horizontal. */
export const RESPONSIVE_BASE_WIDTH = 375;

/**
 * Escala um valor de design (definido a 375pt de largura) para a largura atual.
 * Usar para espaçamentos, raios, ícones e tipografia na home do motorista.
 */
export function normalize(size: number, screenWidth?: number): number {
  const w = screenWidth ?? Dimensions.get('window').width;
  const scaled = (w / RESPONSIVE_BASE_WIDTH) * size;
  return Math.max(1, Math.round(scaled * 10) / 10);
}

/** Diâmetro do botão ONLINE/OFFLINE: 30% da largura do ecrã (ligeiramente limitado para leitura). */
export function onlineToggleDiameter(screenWidth: number): number {
  const raw = screenWidth * 0.3;
  return Math.round(Math.min(128, Math.max(88, raw)));
}

/** Largura máxima de cartões/listas com margem lateral (não “100%” sem padding). */
export function contentMaxWidth(screenWidth: number, horizontalPadding: number): number {
  return Math.min(420, Math.round(screenWidth - horizontalPadding * 2));
}
