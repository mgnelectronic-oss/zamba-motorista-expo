/**
 * Bearing ao longo da polyline oficial (navegação) + utilitários geográficos.
 * Usado só para rotação visual do marcador — não recalcula geometria.
 */

export type MapCoord = { latitude: number; longitude: number };

/** Bearing inicial entre dois pontos (graus, 0 = Norte, sentido horário). */
export function bearingBetween(a: MapCoord, b: MapCoord): number {
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (((θ * 180) / Math.PI) + 360) % 360;
}

function dist2ToSegment(p: MapCoord, a: MapCoord, b: MapCoord): number {
  const px = p.longitude;
  const py = p.latitude;
  const x1 = a.longitude;
  const y1 = a.latitude;
  const x2 = b.longitude;
  const y2 = b.latitude;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    const ex = px - x1;
    const ey = py - y1;
    return ex * ex + ey * ey;
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx;
  const ny = y1 + t * dy;
  const ex = px - nx;
  const ey = py - ny;
  return ex * ex + ey * ey;
}

/**
 * Bearing do segmento da rota mais próximo do GPS — alinha o carro ao trajeto.
 */
export function bearingAlongPolyline(coords: MapCoord[], lat: number, lng: number): number | null {
  if (coords.length < 2) return null;
  let bestI = 0;
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = dist2ToSegment({ latitude: lat, longitude: lng }, coords[i], coords[i + 1]);
    if (d < best) {
      best = d;
      bestI = i;
    }
  }
  return bearingBetween(coords[bestI], coords[bestI + 1]);
}

/** Projeta o ponto no segmento AB (graus, espaço lat/lng). */
function projectOntoSegment(p: MapCoord, a: MapCoord, b: MapCoord): MapCoord {
  const px = p.longitude;
  const py = p.latitude;
  const x1 = a.longitude;
  const y1 = a.latitude;
  const x2 = b.longitude;
  const y2 = b.latitude;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { ...a };
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return { latitude: y1 + t * dy, longitude: x1 + t * dx };
}

/**
 * Ponto mais próximo na polyline (snap visual do marcador à rota oficial).
 */
export function nearestPointOnPolyline(coords: MapCoord[], lat: number, lng: number): MapCoord {
  const p: MapCoord = { latitude: lat, longitude: lng };
  if (coords.length === 0) return p;
  if (coords.length === 1) return { ...coords[0] };
  let best = projectOntoSegment(p, coords[0], coords[1]);
  let bestD = dist2ToSegment(p, coords[0], coords[1]);
  for (let i = 1; i < coords.length - 1; i++) {
    const d = dist2ToSegment(p, coords[i], coords[i + 1]);
    if (d < bestD) {
      bestD = d;
      best = projectOntoSegment(p, coords[i], coords[i + 1]);
    }
  }
  return best;
}

/** Diferença angular mínima (-180..180]. */
export function shortestAngleDiffDeg(from: number, to: number): number {
  return ((((to - from + 540) % 360) + 360) % 360) - 180;
}

/** Interpolação angular suave (evita salto 350° → 10°). */
export function lerpHeadingDeg(current: number, target: number, t: number): number {
  const d = shortestAngleDiffDeg(current, target);
  return (current + d * t + 360) % 360;
}
