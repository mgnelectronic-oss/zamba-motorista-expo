/** Câmera navegação estilo apps de transporte (tilt + zoom + heading). */

/** Zoom ~15–17: 16 equilibra visão da frente e contexto da rua. */
export const NAV_ZOOM = 16;

/** Inclinação 3D (45–60°). */
export const NAV_PITCH = 52;

/** Animação quando o movimento é maior (recentrar, primeira rota). */
export const NAV_CAMERA_ANIM_MS = 420;

/** Atualizações frequentes ao seguir o GPS — mais curtas para fluidez. */
export const NAV_CAMERA_FOLLOW_MS = 280;

/** `initialRegion` aproximado ao zoom de navegação (antes de `animateCamera`). */
export const NAV_REGION_DELTA = 0.0072;

/**
 * Visão geral da rota (`fitToCoordinates`): não aproximar mais que este nível
 * (evita enquadramento demasiado fechado quando o trajeto é curto).
 */
export const ROUTE_OVERVIEW_MAX_ZOOM = 15;
