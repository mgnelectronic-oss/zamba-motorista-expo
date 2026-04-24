import { bearingBetween, nearestPointOnPolyline, type MapCoord } from '@/lib/navigation/routeBearing';

function signedBearingDelta(fromDeg: number, toDeg: number): number {
  let d = (((toDeg - fromDeg) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
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

/** Índice do segmento mais próximo do ponto (segmento i → i+1). */
function nearestSegmentIndex(coords: MapCoord[], lat: number, lng: number): number {
  if (coords.length < 2) return 0;
  const p: MapCoord = { latitude: lat, longitude: lng };
  let bestI = 0;
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = dist2ToSegment(p, coords[i], coords[i + 1]);
    if (d < best) {
      best = d;
      bestI = i;
    }
  }
  return bestI;
}

const TURN_SHARP = 55;
const TURN_MODERATE = 25;

function classifyTurn(deltaDeg: number): string {
  const a = Math.abs(deltaDeg);
  if (a < TURN_MODERATE) return 'Siga em frente';
  if (deltaDeg > 0) {
    if (a >= TURN_SHARP) return 'Vire à direita';
    return 'Mantenha-se à direita';
  }
  if (a >= TURN_SHARP) return 'Vire à esquerda';
  return 'Mantenha-se à esquerda';
}

export type ManeuverHints = { primary: string; secondary: string | null };

/**
 * Instruções aproximadas a partir da geometria (sem passos do backend).
 */
export function getManeuverHints(coords: MapCoord[], lat: number, lng: number): ManeuverHints {
  if (!coords || coords.length < 2) {
    return { primary: 'Siga pela rota', secondary: null };
  }

  const snapped = nearestPointOnPolyline(coords, lat, lng);
  const segI = nearestSegmentIndex(coords, snapped.latitude, snapped.longitude);

  const incoming = bearingBetween(coords[segI], coords[segI + 1]);

  if (segI + 2 < coords.length) {
    const outgoing = bearingBetween(coords[segI + 1], coords[segI + 2]);
    const delta = signedBearingDelta(incoming, outgoing);
    const primary = classifyTurn(delta);

    let secondary: string | null = null;
    if (segI + 3 < coords.length) {
      const nextOut = bearingBetween(coords[segI + 2], coords[segI + 3]);
      const delta2 = signedBearingDelta(outgoing, nextOut);
      if (Math.abs(delta2) >= TURN_MODERATE) {
        const nextText = classifyTurn(delta2);
        if (nextText !== 'Siga em frente') {
          secondary = `Depois ${nextText.toLowerCase()}`;
        }
      }
    }

    return { primary, secondary };
  }

  return { primary: 'Siga em frente', secondary: null };
}
