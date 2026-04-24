/**
 * Rota ao vivo — única fonte: tabela `ride_live_route` (polyline oficial do backend).
 *
 * Edge Function HTTP: `POST {SUPABASE_URL}/functions/v1/recalculate-live-route`
 * No cliente: `supabase.functions.invoke('recalculate-live-route', { body: { ride_id, driver_lat, driver_lng } })`
 *
 * Ficheiros que chamam a função: `hooks/useDriverOffers.ts` (aceite), `app/driver/active.tsx` (viagem + retry).
 * Leitura da polyline: `getLiveRoute()` aqui; o mapa só faz decode da string (não calcula geometria).
 */

import * as Location from 'expo-location';
import { SUPABASE_ANON_KEY } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { RideLiveRouteRow } from '@/types/rideFlow';

export const LIVE_ROUTE_LOG_TAG = '[live-route]';

function log(...args: unknown[]) {
  console.log(LIVE_ROUTE_LOG_TAG, ...args);
}

function summarizeRow(row: RideLiveRouteRow | null) {
  if (!row) return null;
  return {
    ride_id: row.ride_id,
    route_phase: row.route_phase,
    polyline_chars: row.polyline?.length ?? 0,
    distance_meters: row.distance_meters,
    duration_seconds: row.duration_seconds,
    updated_at: row.updated_at,
  };
}

/** Intervalo mínimo entre retries quando polyline vem vazia. */
export const LIVE_ROUTE_EMPTY_RETRY_MIN_MS = 8000;

export const LIVE_ROUTE_MAX_EMPTY_RETRIES = 4;

export type RoutePhase = 'to_pickup' | 'to_destination';

export function expectedRoutePhaseForRideStatus(rideStatus: string): RoutePhase | null {
  if (['accepted', 'arriving', 'arrived'].includes(rideStatus)) return 'to_pickup';
  if (rideStatus === 'ontrip') return 'to_destination';
  return null;
}

/**
 * RPC `should_refresh_ride_live_route` (se existir no projeto).
 */
export async function shouldRefreshRoute(
  rideId: string,
  driverLat: number,
  driverLng: number,
): Promise<boolean> {
  log('shouldRefreshRoute RPC', { ride_id: rideId, driver_lat: driverLat, driver_lng: driverLng });
  const { data, error } = await supabase.rpc('should_refresh_ride_live_route', {
    p_ride_id: rideId,
    p_driver_lat: driverLat,
    p_driver_lng: driverLng,
  });
  if (error) {
    log('shouldRefreshRoute RPC error:', error.message, error);
    return false;
  }
  const should = Boolean((data as { should_refresh?: boolean } | null)?.should_refresh);
  log('shouldRefreshRoute RPC result:', { should_refresh: should, raw: data });
  return should;
}

/**
 * Melhor esforço: posição atual → última conhecida (ex.: aceite sem permissão “sempre” / timeout GPS).
 * Sem coordenadas não se deve chamar a Edge Function (payload obrigatório).
 */
export async function getBestDriverCoordinates(): Promise<{ driver_lat: number; driver_lng: number } | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status === 'granted') {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { driver_lat: pos.coords.latitude, driver_lng: pos.coords.longitude };
    } catch (e) {
      console.warn(LIVE_ROUTE_LOG_TAG, 'getCurrentPositionAsync falhou, a tentar última posição', e);
    }
  } else {
    console.warn(LIVE_ROUTE_LOG_TAG, 'permissão de localização não concedida (foreground)', perm.status);
  }
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 900000 });
    if (last) {
      console.log(LIVE_ROUTE_LOG_TAG, 'a usar getLastKnownPositionAsync');
      return { driver_lat: last.coords.latitude, driver_lng: last.coords.longitude };
    }
  } catch {
    /* noop */
  }
  return null;
}

/**
 * Chama a Edge Function (POST {SUPABASE_URL}/functions/v1/recalculate-live-route).
 * Payload exato: ride_id, driver_lat, driver_lng.
 * Cabeçalhos: Content-Type, apikey, Authorization (JWT da sessão ou anon key).
 */
export async function recalculateRoute(
  rideId: string,
  driverLat: number,
  driverLng: number,
): Promise<{ data: unknown; error: Error | null }> {
  const payload = { ride_id: rideId, driver_lat: driverLat, driver_lng: driverLng };
  console.log('CALLING ROUTE FUNCTION', payload);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const bearer = session?.access_token ?? SUPABASE_ANON_KEY;

  try {
    const { data, error } = await supabase.functions.invoke('recalculate-live-route', {
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${bearer}`,
      },
    });
    if (error) {
      console.error('ROUTE ERROR', error);
    } else {
      console.log('ROUTE RESPONSE', data);
    }
    return { data, error: error as Error | null };
  } catch (err) {
    console.error('ROUTE ERROR', err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Lê a linha oficial em `ride_live_route` (polyline, route_phase, etc.).
 */
export async function getLiveRoute(rideId: string): Promise<RideLiveRouteRow | null> {
  log('getLiveRoute SELECT ride_live_route', { ride_id: rideId });
  const { data, error } = await supabase.from('ride_live_route').select('*').eq('ride_id', rideId).maybeSingle();
  if (error) {
    log('getLiveRoute error:', error.message, error);
    return null;
  }
  log('getLiveRoute result:', summarizeRow(data as RideLiveRouteRow | null), {
    polyline_empty: !((data as RideLiveRouteRow | null)?.polyline?.trim()),
  });
  return data as RideLiveRouteRow | null;
}

/**
 * Após a Edge Function: releer sempre `ride_live_route` para o mapa.
 */
export async function recalculateRouteAndReload(
  rideId: string,
  driverLat: number,
  driverLng: number,
  reason?: string,
): Promise<RideLiveRouteRow | null> {
  log('recalculateRouteAndReload', reason ?? '(no reason)', { ride_id: rideId, driver_lat: driverLat, driver_lng: driverLng });
  await recalculateRoute(rideId, driverLat, driverLng);
  return getLiveRoute(rideId);
}

/**
 * shouldRefresh → (se aplicável) Edge Function → getLiveRoute.
 * `force: true` — ex.: aceite da corrida ou início ontrip (backend define fase pela corrida).
 */
export async function syncLiveRouteFromServer(
  rideId: string,
  driverLat: number,
  driverLng: number,
  options: { force?: boolean } = {},
): Promise<RideLiveRouteRow | null> {
  const { force = false } = options;
  log('syncLiveRouteFromServer', { force, ride_id: rideId, driver_lat: driverLat, driver_lng: driverLng });

  if (force) {
    log('syncLiveRouteFromServer: force=true → recalculate + getLiveRoute');
    return recalculateRouteAndReload(rideId, driverLat, driverLng, 'sync:force');
  }

  const need = await shouldRefreshRoute(rideId, driverLat, driverLng);
  if (!need) {
    log('syncLiveRouteFromServer: should_refresh=false → sem chamada à Edge Function');
    return null;
  }

  log('syncLiveRouteFromServer: should_refresh=true → recalculate + getLiveRoute');
  return recalculateRouteAndReload(rideId, driverLat, driverLng, 'sync:rpc');
}

export function isLiveRouteRowValidForStatus(row: RideLiveRouteRow | null, rideStatus: string): boolean {
  if (!row?.polyline?.trim()) return false;
  const expected = expectedRoutePhaseForRideStatus(rideStatus);
  if (!expected || row.route_phase !== expected) return false;
  return row.distance_meters != null && row.duration_seconds != null;
}

export function canRetryEmptyPolyline(now: number, lastAttemptAt: number, attempts: number): boolean {
  return attempts < LIVE_ROUTE_MAX_EMPTY_RETRIES && now - lastAttemptAt >= LIVE_ROUTE_EMPTY_RETRY_MIN_MS;
}

/**
 * Retry controlado se polyline null/vazia: recalcula e relê; regista tentativa nos refs do ecrã.
 */
export async function retryEmptyPolylineControlled(
  rideId: string,
  driverLat: number,
  driverLng: number,
  rideStatus: string,
  state: { lastAt: number; count: number },
  now: number,
): Promise<RideLiveRouteRow | null> {
  if (!canRetryEmptyPolyline(now, state.lastAt, state.count)) {
    log('retryEmptyPolyline: skipped (cooldown or max)', {
      attempts: state.count,
      max: LIVE_ROUTE_MAX_EMPTY_RETRIES,
      ms_since_last: now - state.lastAt,
    });
    return null;
  }
  state.lastAt = now;
  state.count += 1;
  log('retryEmptyPolyline: attempt', state.count, '/', LIVE_ROUTE_MAX_EMPTY_RETRIES, {
    ride_id: rideId,
    ride_status: rideStatus,
  });
  const row = await recalculateRouteAndReload(rideId, driverLat, driverLng, 'retry:empty_polyline');
  if (row && !row.polyline?.trim()) {
    log('retryEmptyPolyline: still empty after recalculate', summarizeRow(row));
  }
  return row;
}
