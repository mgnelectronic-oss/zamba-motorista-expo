import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { AnimatedRegion, Marker, MarkerAnimated, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { haversineKm } from '@/lib/geo';
import { decodePolyline } from '@/lib/polylineDecode';
import { DriverNavigationArrow } from '@/components/driver/DriverNavigationArrow';
import { InternetCallRemoteAudio } from '@/components/driver/InternetCallRemoteAudio';
import { DEFAULT_MAP_REGION } from '@/lib/mapConfig';
import {
  NAV_CAMERA_ANIM_MS,
  NAV_CAMERA_FOLLOW_MS,
  NAV_PITCH,
  NAV_REGION_DELTA,
  NAV_ZOOM,
  ROUTE_OVERVIEW_MAX_ZOOM,
} from '@/lib/navigation/navigationCamera';
import { ROUTE_LINE_COLOR, ROUTE_LINE_WIDTH } from '@/lib/navigation/activeRouteLineStyle';
import { getManeuverHints } from '@/lib/navigation/routeManeuvers';
import {
  bearingAlongPolyline,
  bearingBetween,
  nearestPointOnPolyline,
  shortestAngleDiffDeg,
} from '@/lib/navigation/routeBearing';
import { useDriverInternetVoiceCall } from '@/hooks/useDriverInternetVoiceCall';
import { useSmoothedNavigationHeading } from '@/hooks/useSmoothedNavigationHeading';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { driverService } from '@/services/driverService';
import { updateRideStatusAndTriggerNotifications } from '@/services/rideStatusNotifications';
import {
  getLiveRoute,
  isLiveRouteRowValidForStatus,
  LIVE_ROUTE_LOG_TAG,
  recalculateRouteAndReload,
  retryEmptyPolylineControlled,
  syncLiveRouteFromServer,
} from '@/services/routeService';
import type { DriverActiveRideDetails, RideLiveRouteRow } from '@/types/rideFlow';
import { formatCurrencyMzn } from '@/lib/formatMz';
import { createActiveRideStyles } from '@/theme/screens/activeRideStyles';
import * as Speech from 'expo-speech';

function isValidMapCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Limite de pontos para `fitToCoordinates` (polylines muito longas). */
const FIT_BOUNDS_MAX_POINTS = 350;

function sampleCoordsForFit(
  coords: { latitude: number; longitude: number }[],
  maxPoints: number,
): { latitude: number; longitude: number }[] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const out: { latitude: number; longitude: number }[] = [];
  for (let i = 0; i < coords.length; i += step) {
    out.push(coords[i]);
  }
  const last = coords[coords.length - 1];
  const prev = out[out.length - 1];
  if (!prev || prev.latitude !== last.latitude || prev.longitude !== last.longitude) {
    out.push(last);
  }
  return out;
}

/**
 * Corrida ativa — rota no mapa:
 *   • Edge Function: `syncLiveRouteFromServer` / `recalculateRoute` em `@/services/routeService` (GPS, mudança de estado, início de viagem).
 *   • Leitura BD: `getLiveRoute` + subscrição Realtime em `ride_live_route` (redesenho quando `updated_at` muda).
 *   • Fase pickup vs destino: `isLiveRouteRowValidForStatus` alinha `route_phase` com `rides.status` (to_pickup até `arrived`; `ontrip` → to_destination).
 */
/** Evita re-decodificar a mesma polyline (Realtime + vários setState). */
const ROUTE_DECODE_CACHE = new Map<string, { latitude: number; longitude: number }[]>();
const ROUTE_DECODE_CACHE_MAX = 36;

function routeDecodeCacheKey(row: RideLiveRouteRow): string {
  const p = row.polyline ?? '';
  let h = 0;
  for (let i = 0; i < p.length; i++) h = (Math.imul(31, h) + p.charCodeAt(i)) | 0;
  return `${row.updated_at ?? ''}:${p.length}:${h}`;
}

/** Mapa: só geometria vinda de `ride_live_route.polyline` (decode com cache). */
function liveRouteToMapState(row: RideLiveRouteRow) {
  const key = routeDecodeCacheKey(row);
  let coords = ROUTE_DECODE_CACHE.get(key);
  if (!coords) {
    coords = decodePolyline(row.polyline);
    if (ROUTE_DECODE_CACHE.size >= ROUTE_DECODE_CACHE_MAX) {
      const first = ROUTE_DECODE_CACHE.keys().next().value;
      if (first) ROUTE_DECODE_CACHE.delete(first);
    }
    ROUTE_DECODE_CACHE.set(key, coords);
  }
  return {
    coords,
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    routePhase: row.route_phase,
    updatedAt: row.updated_at ?? '',
  };
}

export default function ActiveRideScreen() {
  const { ride_id: rideId, pickup_lat: pickupLatParam, pickup_lng: pickupLngParam } = useLocalSearchParams<{
    ride_id?: string;
    pickup_lat?: string;
    pickup_lng?: string;
  }>();
  const { session } = useAppAuth();
  const userId = session?.user?.id;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createActiveRideStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [ride, setRide] = useState<DriverActiveRideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveRoute, setLiveRoute] = useState<{
    coords: { latitude: number; longitude: number }[];
    distanceMeters: number;
    durationSeconds: number;
    routePhase: string;
    updatedAt: string;
  } | null>(null);
  const [coord, setCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [completedRide, setCompletedRide] = useState<DriverActiveRideDetails | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [accumulatedKm, setAccumulatedKm] = useState(0);
  const [driverMarkerInit, setDriverMarkerInit] = useState(false);
  const [callOptionsVisible, setCallOptionsVisible] = useState(false);

  const pickupFromParams = useMemo(() => {
    const lat = pickupLatParam != null ? Number(pickupLatParam) : NaN;
    const lng = pickupLngParam != null ? Number(pickupLngParam) : NaN;
    if (!isValidMapCoord(lat, lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [pickupLatParam, pickupLngParam]);

  const passengerUserId = useMemo(() => {
    if (!ride) return undefined;
    const id =
      ride.passenger_user_id?.trim() ||
      ride.passenger_id?.trim() ||
      ride.passenger?.user_id?.trim() ||
      ride.passenger?.id?.trim() ||
      '';
    return id || undefined;
  }, [ride]);

  const {
    internetCallUi,
    remoteStream,
    startInternetCall,
    endCallByUser,
    dismissEndedBanner,
    isInternetCallActive,
    isStartingInternetCall,
  } = useDriverInternetVoiceCall({
    rideId: typeof rideId === 'string' ? rideId : undefined,
    passengerUserId,
  });

  const lastLiveCall = useRef<{ t: number; lat: number; lng: number; status: string }>({
    t: 0,
    lat: 0,
    lng: 0,
    status: '',
  });
  const callingLive = useRef(false);
  const tripStartRef = useRef<number | null>(null);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const watchSub = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLiveRouteUpdatedAtRef = useRef<string | null>(null);
  const emptyPolylineRetryRef = useRef<{ lastAt: number; count: number }>({ lastAt: 0, count: 0 });
  const coordRef = useRef<{ latitude: number; longitude: number } | null>(null);
  /** Garante pelo menos uma chamada à Edge em recolha por corrida (RPC pode devolver should_refresh=false). */
  const pickupEdgeOnceRef = useRef<Set<string>>(new Set());

  const mapRef = useRef<React.ElementRef<typeof MapView> | null>(null);
  const mapReadyRef = useRef(false);
  /** Última câmera de navegação aplicada — throttling (distância / heading / tempo). */
  const lastCameraNavRef = useRef<{ lat: number; lng: number; h: number; t: number } | null>(null);
  const animatedDriverCoord = useRef<AnimatedRegion | null>(null);
  const liveRouteRef = useRef(liveRoute);
  liveRouteRef.current = liveRoute;

  const [courseTargetDeg, setCourseTargetDeg] = useState(0);
  const smoothedCourseDeg = useSmoothedNavigationHeading(courseTargetDeg, 0.18);
  const smoothedCourseDegRef = useRef(smoothedCourseDeg);
  smoothedCourseDegRef.current = smoothedCourseDeg;
  const lastGpsHeadingRef = useRef<number | null>(null);
  /** Só visual: marcador colado à polyline; GPS cru mantém-se em `coord` / backend. */
  const snappedCoord = useMemo(() => {
    if (!coord) return null;
    const { latitude: lat, longitude: lng } = coord;
    if (!isValidMapCoord(lat, lng)) return null;
    const c = liveRoute?.coords;
    if (c && c.length >= 2) {
      const p = nearestPointOnPolyline(c, lat, lng);
      if (!isValidMapCoord(p.latitude, p.longitude)) return { latitude: lat, longitude: lng };
      return p;
    }
    return { latitude: lat, longitude: lng };
  }, [coord, liveRoute?.coords]);

  const snappedCoordRef = useRef(snappedCoord);
  snappedCoordRef.current = snappedCoord;

  const [mapFollowsDriver, setMapFollowsDriver] = useState(true);
  const mapFollowsDriverRef = useRef(mapFollowsDriver);
  mapFollowsDriverRef.current = mapFollowsDriver;
  /** Evita tratar animações da câmera como pan manual. */
  const ignorePanDragUntilRef = useRef(0);

  useEffect(() => {
    if (!snappedCoord) return;
    const lr = liveRouteRef.current?.coords;
    let courseDeg = lastGpsHeadingRef.current ?? 0;
    if (lr && lr.length >= 2) {
      const along = bearingAlongPolyline(lr, snappedCoord.latitude, snappedCoord.longitude);
      if (along != null) courseDeg = along;
    } else if (lastPos.current) {
      courseDeg = bearingBetween(
        { latitude: lastPos.current.lat, longitude: lastPos.current.lng },
        snappedCoord,
      );
    }
    setCourseTargetDeg(courseDeg);
  }, [snappedCoord]);

  const maneuverHints = useMemo(() => {
    const c = liveRoute?.coords;
    if (!c || c.length < 2 || !snappedCoord) {
      return { primary: 'Siga pela rota', secondary: null as string | null };
    }
    return getManeuverHints(c, snappedCoord.latitude, snappedCoord.longitude);
  }, [liveRoute?.coords, snappedCoord]);

  const lastSpokenInstructionRef = useRef<string>('');

  useEffect(() => {
    const text = maneuverHints.primary;
    if (!text || text === 'Siga pela rota') return;
    if (text === lastSpokenInstructionRef.current) return;
    lastSpokenInstructionRef.current = text;
    Speech.stop();
    Speech.speak(text, { language: 'pt-PT', rate: 0.96, pitch: 1 });
  }, [maneuverHints.primary]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  /** Carregamento inicial: detalhes da corrida + rota em paralelo (mapa já visível). */
  useEffect(() => {
    if (!rideId || typeof rideId !== 'string') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [data, routeRow] = await Promise.all([
          driverService.getRideDetails(rideId),
          getLiveRoute(rideId),
        ]);
        if (cancelled) return;
        if (data) {
          setRide(data);
          if (data.status === 'completed' || data.status === 'completed_by_driver') {
            setCompletedRide(data);
            setShowSummary(true);
          }
          if (data.status === 'ontrip' && data.started_at) {
            tripStartRef.current = new Date(data.started_at).getTime();
          }
        } else {
          setRide(null);
        }
        if (data && routeRow && isLiveRouteRowValidForStatus(routeRow, data.status)) {
          lastLiveRouteUpdatedAtRef.current = routeRow.updated_at;
          setLiveRoute(liveRouteToMapState(routeRow));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  useEffect(() => {
    if (!rideId || typeof rideId !== 'string') return;

    const ch = supabase
      .channel(`ride-updates-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
        (payload) => {
          const row = payload.new as DriverActiveRideDetails;
          setRide((prev) => ({ ...(prev || row), ...row }));
          if (row.status === 'cancelled' || row.status === 'cancelled_by_driver') {
            Alert.alert('Corrida cancelada', 'A corrida foi cancelada.');
            router.replace('/(tabs)' as never);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [rideId]);

  useEffect(() => {
    emptyPolylineRetryRef.current = { lastAt: 0, count: 0 };
  }, [rideId, ride?.status]);

  useEffect(() => {
    animatedDriverCoord.current = null;
    setDriverMarkerInit(false);
  }, [rideId]);

  useEffect(() => {
    if (animatedDriverCoord.current) return;
    const fromRide =
      ride && isValidMapCoord(ride.pickup_lat, ride.pickup_lng)
        ? { latitude: ride.pickup_lat, longitude: ride.pickup_lng }
        : null;
    const seed = fromRide ?? pickupFromParams;
    if (!seed) return;
    animatedDriverCoord.current = new AnimatedRegion({
      latitude: seed.latitude,
      longitude: seed.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    });
    setDriverMarkerInit(true);
  }, [ride, pickupFromParams]);

  useEffect(() => {
    if (!snappedCoord || !animatedDriverCoord.current) return;
    const { latitude: lat, longitude: lng } = snappedCoord;
    if (!isValidMapCoord(lat, lng)) return;
    animatedDriverCoord.current.timing({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0,
      longitudeDelta: 0,
      duration: 340,
      useNativeDriver: false,
    } as never).start();
  }, [snappedCoord]);

  useEffect(() => {
    mapReadyRef.current = false;
    lastCameraNavRef.current = null;
  }, [rideId]);

  useEffect(() => {
    if (!mapFollowsDriver || !mapRef.current || !snappedCoord || !mapReadyRef.current) return;
    const lat = snappedCoord.latitude;
    const lng = snappedCoord.longitude;
    const heading = smoothedCourseDegRef.current;
    const prev = lastCameraNavRef.current;
    const now = Date.now();
    let shouldAnimate = !prev;
    if (prev) {
      const distM = haversineKm(prev.lat, prev.lng, lat, lng) * 1000;
      const dH = Math.abs(shortestAngleDiffDeg(prev.h, heading));
      shouldAnimate = distM > 1.2 || dH > 4.5 || now - prev.t > 720;
    }
    if (!shouldAnimate) return;
    lastCameraNavRef.current = { lat, lng, h: heading, t: now };
    const distM = prev ? haversineKm(prev.lat, prev.lng, lat, lng) * 1000 : 99;
    const duration = distM < 14 ? NAV_CAMERA_FOLLOW_MS : NAV_CAMERA_ANIM_MS;
    ignorePanDragUntilRef.current = now + duration + 70;
    mapRef.current.animateCamera(
      {
        center: { latitude: lat, longitude: lng },
        pitch: NAV_PITCH,
        heading,
        zoom: NAV_ZOOM,
      },
      { duration },
    );
  }, [mapFollowsDriver, snappedCoord, smoothedCourseDeg]);

  const onMapReady = useCallback(() => {
    mapReadyRef.current = true;
    lastCameraNavRef.current = null;
    const pos = snappedCoordRef.current;
    if (!mapRef.current || !pos || !mapFollowsDriverRef.current) return;
    const heading = smoothedCourseDegRef.current;
    ignorePanDragUntilRef.current = Date.now() + NAV_CAMERA_ANIM_MS + 80;
    mapRef.current.animateCamera(
      {
        center: { latitude: pos.latitude, longitude: pos.longitude },
        pitch: NAV_PITCH,
        heading,
        zoom: NAV_ZOOM,
      },
      { duration: NAV_CAMERA_ANIM_MS },
    );
  }, []);

  const handleRecenterMap = useCallback(() => {
    setMapFollowsDriver(true);
    lastCameraNavRef.current = null;
    if (!mapRef.current || !snappedCoord) return;
    ignorePanDragUntilRef.current = Date.now() + NAV_CAMERA_ANIM_MS + 100;
    mapRef.current.animateCamera(
      {
        center: { latitude: snappedCoord.latitude, longitude: snappedCoord.longitude },
        pitch: NAV_PITCH,
        heading: smoothedCourseDeg,
        zoom: NAV_ZOOM,
      },
      { duration: NAV_CAMERA_ANIM_MS },
    );
  }, [snappedCoord, smoothedCourseDeg]);

  const liveRouteChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const rideStatusRef = useRef(ride?.status);
  rideStatusRef.current = ride?.status;

  /** Leitura inicial + Realtime: `ride_live_route` é a única fonte; redesenha quando `updated_at` muda. */
  useEffect(() => {
    if (!rideId || !ride?.status) return;
    const allowed = ['accepted', 'arriving', 'arrived', 'ontrip'].includes(ride.status);
    if (!allowed) {
      setLiveRoute(null);
      lastLiveRouteUpdatedAtRef.current = null;
      return;
    }

    const statusSnapshot = ride.status;
    /**
     * O Supabase reutiliza o mesmo objeto de canal pelo nome do tópico. Se este efeito re-correr
     * enquanto um `getLiveRoute` anterior ainda está em voo, duas IIFEs podem tentar `.on()` no
     * mesmo canal já subscrito → "cannot add postgres_changes ... after subscribe()".
     */
    let cancelled = false;

    void (async () => {
      const lrChannel = supabase
        .channel(`lr-${rideId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ride_live_route',
            filter: `ride_id=eq.${rideId}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              setLiveRoute(null);
              lastLiveRouteUpdatedAtRef.current = null;
              return;
            }
            const row = payload.new as RideLiveRouteRow;
            if (row.updated_at && row.updated_at === lastLiveRouteUpdatedAtRef.current) return;
            const st = rideStatusRef.current || statusSnapshot;
            if (row && isLiveRouteRowValidForStatus(row, st)) {
              lastLiveRouteUpdatedAtRef.current = row.updated_at ?? null;
              setLiveRoute(liveRouteToMapState(row));
            }
          },
        )
        .subscribe();

      if (cancelled) {
        void supabase.removeChannel(lrChannel);
        return;
      }
      liveRouteChannelRef.current = lrChannel;
    })();

    return () => {
      cancelled = true;
      const ch = liveRouteChannelRef.current;
      liveRouteChannelRef.current = null;
      if (ch) void supabase.removeChannel(ch);
    };
  }, [rideId, ride?.status]);

  /**
   * Com GPS: primeira fixação em fase de recolha força a Edge (a RPC costuma devolver should_refresh=false).
   * Em ontrip a função é chamada em `handleStart` e nos retries de polyline vazia.
   */
  useEffect(() => {
    if (!rideId || !ride?.status || !coord) return;
    const st = ride.status;
    if (!['accepted', 'arriving', 'arrived', 'ontrip'].includes(st)) return;

    let cancelled = false;
    void (async () => {
      const pickup = ['accepted', 'arriving', 'arrived'].includes(st);
      let force = false;
      if (pickup && !pickupEdgeOnceRef.current.has(rideId)) {
        pickupEdgeOnceRef.current.add(rideId);
        force = true;
      }
      const row = await syncLiveRouteFromServer(rideId, coord.latitude, coord.longitude, { force });
      if (cancelled) return;
      if (row && isLiveRouteRowValidForStatus(row, st)) {
        lastLiveRouteUpdatedAtRef.current = row.updated_at;
        setLiveRoute(liveRouteToMapState(row));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rideId, ride?.status, coord]);

  useEffect(() => {
    if (ride?.status !== 'ontrip') {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (!tripStartRef.current) tripStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const start = tripStartRef.current || Date.now();
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ride?.status]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;
      watchSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 8, timeInterval: 2000 },
        (loc) => {
          const { latitude, longitude, heading: h } = loc.coords;
          setCoord({ latitude, longitude });
          coordRef.current = { latitude, longitude };
          if (h != null && h >= 0 && !Number.isNaN(h)) {
            lastGpsHeadingRef.current = h;
          }
          if (userId) {
            void driverService.updateCurrentLocation(userId, latitude, longitude);
          }
          const st = ride?.status;
          if (!rideId || !st) return;
          if (!['accepted', 'arriving', 'arrived', 'ontrip'].includes(st)) return;

          const now = Date.now();
          const last = lastLiveCall.current;
          const distM =
            last.lat === 0
              ? 999
              : haversineKm(last.lat, last.lng, latitude, longitude) * 1000;
          const statusChanged = last.status !== st;
          if (now - last.t >= 10000 || distM >= 50 || statusChanged) {
            if (!callingLive.current) {
              callingLive.current = true;
              void (async () => {
                try {
                  let row = await syncLiveRouteFromServer(rideId, latitude, longitude, { force: false });
                  if (row && isLiveRouteRowValidForStatus(row, st)) {
                    lastLiveRouteUpdatedAtRef.current = row.updated_at;
                    setLiveRoute(liveRouteToMapState(row));
                  } else {
                    const fromDb = await getLiveRoute(rideId);
                    if (fromDb && isLiveRouteRowValidForStatus(fromDb, st)) {
                      lastLiveRouteUpdatedAtRef.current = fromDb.updated_at;
                      setLiveRoute(liveRouteToMapState(fromDb));
                    } else if (!fromDb?.polyline?.trim()) {
                      const r = emptyPolylineRetryRef.current;
                      const again = await retryEmptyPolylineControlled(
                        rideId,
                        latitude,
                        longitude,
                        st,
                        r,
                        now,
                      );
                      if (again && isLiveRouteRowValidForStatus(again, st)) {
                        lastLiveRouteUpdatedAtRef.current = again.updated_at;
                        setLiveRoute(liveRouteToMapState(again));
                      }
                    }
                  }
                } finally {
                  callingLive.current = false;
                }
              })();
              lastLiveCall.current = { t: now, lat: latitude, lng: longitude, status: st };
            }
          }

          if (st === 'ontrip' && lastPos.current) {
            const d = haversineKm(
              lastPos.current.lat,
              lastPos.current.lng,
              latitude,
              longitude,
            );
            if (d > 0.01) setAccumulatedKm((x) => x + d);
          }
          lastPos.current = { lat: latitude, lng: longitude };
        },
      );
    })();
    return () => {
      mounted = false;
      watchSub.current?.remove();
    };
  }, [rideId, userId, ride?.status]);

  const region = useMemo(() => {
    const d = NAV_REGION_DELTA;
    if (coord) {
      return {
        ...coord,
        latitudeDelta: d,
        longitudeDelta: d,
      };
    }
    if (ride) {
      return {
        latitude: ride.pickup_lat,
        longitude: ride.pickup_lng,
        latitudeDelta: d,
        longitudeDelta: d,
      };
    }
    if (pickupFromParams) {
      return {
        ...pickupFromParams,
        latitudeDelta: d,
        longitudeDelta: d,
      };
    }
    return {
      ...DEFAULT_MAP_REGION,
      latitudeDelta: d,
      longitudeDelta: d,
    };
  }, [coord, ride, pickupFromParams]);

  const statusLabel = useMemo(() => {
    if (!ride) return '';
    switch (ride.status) {
      case 'accepted':
      case 'arriving':
        return 'Indo buscar passageiro';
      case 'arrived':
        return 'Cheguei ao local';
      case 'ontrip':
        return 'Em viagem';
      default:
        return ride.status;
    }
  }, [ride]);

  const primary = useMemo(() => {
    if (!ride) return null;
    if (ride.status === 'accepted' || ride.status === 'arriving') {
      return { label: 'Cheguei', onPress: 'arrived' as const };
    }
    if (ride.status === 'arrived') {
      return { label: 'Iniciar viagem', onPress: 'start' as const };
    }
    if (ride.status === 'ontrip') {
      return { label: 'Finalizar viagem', onPress: 'finish' as const, danger: true };
    }
    return null;
  }, [ride]);

  const callPassengerPhone = () => {
    const phone = ride?.passenger?.phone;
    if (!phone) {
      Alert.alert('Contacto', 'Número do passageiro não disponível.');
      return;
    }
    const clean = phone.replace(/\D/g, '');
    const tel = clean.startsWith('258') ? `+${clean}` : `+258${clean}`;
    void Linking.openURL(`tel:${tel}`);
  };

  const openCallOptions = () => {
    setCallOptionsVisible(true);
  };

  const handlePickInternetCall = () => {
    if (isStartingInternetCall) return;
    setCallOptionsVisible(false);
    void startInternetCall();
  };

  const handlePickPhoneCall = () => {
    setCallOptionsVisible(false);
    callPassengerPhone();
  };

  const handleArrived = async () => {
    if (!rideId || !ride) return;
    setUpdating(true);
    try {
      const { error } = await updateRideStatusAndTriggerNotifications(rideId, 'arrived');
      if (error) throw error;
      setRide((r) => (r ? { ...r, status: 'arrived' } : r));
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível registar a chegada.');
    } finally {
      setUpdating(false);
    }
  };

  const handleStart = async () => {
    if (!rideId || !ride || !userId) return;
    setUpdating(true);
    try {
      const op = await driverService.isOperational(userId);
      if (!op.operational) {
        Alert.alert('Indisponível', op.reason || '');
        return;
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('rides')
        .update({ status: 'ontrip', started_at: now, updated_at: now })
        .eq('id', rideId);
      if (error) throw error;
      tripStartRef.current = Date.now();
      setAccumulatedKm(0);
      setRide((r) => (r ? { ...r, status: 'ontrip', started_at: now } : r));

      let lat = coordRef.current?.latitude;
      let lng = coordRef.current?.longitude;
      if (lat == null || lng == null) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      }
      if (rideId && lat != null && lng != null) {
        /** Troca pickup → destino: `rides.status` → ontrip; backend grava `route_phase=to_destination`. */
        console.log(LIVE_ROUTE_LOG_TAG, 'active.tsx handleStart: ontrip → recálculo rota destino', {
          ride_id: rideId,
          driver_lat: lat,
          driver_lng: lng,
        });
        const live = await recalculateRouteAndReload(rideId, lat, lng, 'ontrip:handleStart');
        if (live && isLiveRouteRowValidForStatus(live, 'ontrip')) {
          lastLiveRouteUpdatedAtRef.current = live.updated_at;
          setLiveRoute(liveRouteToMapState(live));
        }
      }
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao iniciar.');
    } finally {
      setUpdating(false);
    }
  };

  const handleFinish = async () => {
    if (!rideId || !ride || !userId) return;
    setUpdating(true);
    try {
      const actualDurationMin = Math.max(1, Math.round(elapsedSec / 60));
      const actualDistanceKm = Number(accumulatedKm.toFixed(2));
      const completedAt = new Date().toISOString();
      const { data: updated, error } = await updateRideStatusAndTriggerNotifications(rideId, 'completed', {
        merge: {
          actual_distance_km: actualDistanceKm,
          actual_duration_min: actualDurationMin,
          completed_at: completedAt,
        },
        select:
          'status, completed_at, actual_distance_km, actual_duration_min, final_fare, fare_final, price_estimate, estimated_fare, fare_estimate',
      });
      if (error) throw error;
      await driverService.setBusyStatus(userId, false);
      setCompletedRide({ ...ride, ...(updated as object) } as DriverActiveRideDetails);
      setShowSummary(true);
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao concluir.');
    } finally {
      setUpdating(false);
    }
  };

  const estimateVal = useMemo(
    () => Number(ride?.price_estimate ?? ride?.estimated_fare ?? ride?.fare_estimate ?? 0),
    [ride],
  );

  const routePolylineKey = useMemo(
    () =>
      liveRoute && rideId
        ? `${String(rideId)}-${liveRoute.routePhase}-${liveRoute.updatedAt}`
        : '',
    [rideId, liveRoute],
  );

  useEffect(() => {
    lastCameraNavRef.current = null;
  }, [routePolylineKey]);

  const navigationPolylineCoords = useMemo(() => {
    if (!routePolylineKey || !liveRoute?.coords?.length) return null;
    return liveRoute.coords;
  }, [routePolylineKey, liveRoute?.coords]);

  const awaitingRouteGeometry = Boolean(
    ride &&
      ['accepted', 'arriving', 'arrived', 'ontrip'].includes(ride.status) &&
      (!liveRoute?.coords?.length || liveRoute.coords.length < 2),
  );

  const showRouteOverviewFab = Boolean(
    navigationPolylineCoords &&
      navigationPolylineCoords.length >= 2 &&
      ride &&
      ['accepted', 'arriving', 'arrived', 'ontrip'].includes(ride.status),
  );

  const handleRouteOverview = useCallback(() => {
    const map = mapRef.current;
    const poly = navigationPolylineCoords;
    if (!map || !poly || poly.length < 2) {
      Alert.alert('Rota', 'A rota ainda não está disponível no mapa.');
      return;
    }
    if (!ride) return;

    setMapFollowsDriver(false);
    lastCameraNavRef.current = null;

    const forFit = sampleCoordsForFit(poly, FIT_BOUNDS_MAX_POINTS);
    const pts: { latitude: number; longitude: number }[] = [...forFit];
    if (snappedCoord && isValidMapCoord(snappedCoord.latitude, snappedCoord.longitude)) {
      pts.push(snappedCoord);
    }
    if (['accepted', 'arriving', 'arrived'].includes(ride.status)) {
      if (isValidMapCoord(ride.pickup_lat, ride.pickup_lng)) {
        pts.push({ latitude: ride.pickup_lat, longitude: ride.pickup_lng });
      }
    }
    if (ride.status === 'ontrip' && isValidMapCoord(ride.destination_lat, ride.destination_lng)) {
      pts.push({ latitude: ride.destination_lat, longitude: ride.destination_lng });
    }

    const topPad = Math.max(insets.top, 8) + 64;
    ignorePanDragUntilRef.current = Date.now() + 900;
    map.fitToCoordinates(pts, {
      edgePadding: { top: topPad, right: 28, bottom: 288, left: 28 },
      animated: true,
    });

    const settleMs = Platform.OS === 'android' ? 580 : 520;
    setTimeout(() => {
      const m = mapRef.current;
      if (!m) return;
      void Promise.resolve(m.getCamera())
        .then((cam) => {
          const z = typeof cam.zoom === 'number' && !Number.isNaN(cam.zoom) ? cam.zoom : ROUTE_OVERVIEW_MAX_ZOOM;
          const zoom = z > ROUTE_OVERVIEW_MAX_ZOOM ? ROUTE_OVERVIEW_MAX_ZOOM : z;
          ignorePanDragUntilRef.current = Date.now() + 480;
          m.animateCamera(
            {
              center: cam.center,
              pitch: 0,
              heading: 0,
              zoom,
            },
            { duration: 380 },
          );
        })
        .catch(() => {});
    }, settleMs);
  }, [navigationPolylineCoords, ride, snappedCoord, insets.top]);

  useEffect(() => {
    if (!__DEV__ || !liveRoute?.coords?.length) return;
    console.log('[active-map] Rendering polyline', {
      pointCount: liveRoute.coords.length,
      routePhase: liveRoute.routePhase,
      key: routePolylineKey,
    });
  }, [liveRoute, routePolylineKey]);

  if (!rideId) {
    return (
      <View style={styles.loadingBox}>
        <Text style={{ color: colors.text }}>ID da corrida em falta.</Text>
        <Pressable onPress={() => router.replace('/(tabs)' as never)} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const rideFetchFailed = !loading && !ride;

  return (
    <View style={styles.root}>
      {/* Mapa padrão Google (sem customMapStyle — evita tiles “vazios” / sem ruas em alguns APK). */}
      <MapView
        key={typeof rideId === 'string' ? rideId : 'active-ride'}
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        liteMode={false}
        mapType="standard"
        loadingEnabled
        showsBuildings
        showsCompass
        showsPointsOfInterest
        showsUserLocation={false}
        showsMyLocationButton={false}
        pitchEnabled
        rotateEnabled
        mapPadding={{
          top: Math.max(insets.top, 8) + 56,
          right: 14,
          bottom: 268,
          left: 14,
        }}
        onMapReady={onMapReady}
        onPanDrag={() => {
          if (Date.now() < ignorePanDragUntilRef.current) return;
          setMapFollowsDriver(false);
        }}
      >
        {driverMarkerInit && animatedDriverCoord.current ? (
          <MarkerAnimated
            coordinate={animatedDriverCoord.current}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}
          >
            <DriverNavigationArrow
              headingDeg={mapFollowsDriver ? 0 : smoothedCourseDeg}
              size={34}
            />
          </MarkerAnimated>
        ) : null}

        {ride && ['accepted', 'arriving', 'arrived'].includes(ride.status) ? (
          <Marker coordinate={{ latitude: ride.pickup_lat, longitude: ride.pickup_lng }} title="Partida">
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: '#EF4444',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '900' }}>P</Text>
            </View>
          </Marker>
        ) : null}

        {ride && ride.status === 'ontrip' ? (
          <Marker coordinate={{ latitude: ride.destination_lat, longitude: ride.destination_lng }} title="Destino">
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '900' }}>D</Text>
            </View>
          </Marker>
        ) : null}

        {navigationPolylineCoords && navigationPolylineCoords.length >= 2 ? (
          <Polyline
            key={`route-${routePolylineKey}`}
            coordinates={navigationPolylineCoords}
            strokeColor={ROUTE_LINE_COLOR}
            strokeWidth={ROUTE_LINE_WIDTH}
            lineCap="round"
            lineJoin="round"
            geodesic
            zIndex={2}
          />
        ) : null}
      </MapView>

      {awaitingRouteGeometry ? (
        <View
          style={[styles.routeLoadingOuter, { top: Math.max(insets.top, 8) + 52 }]}
          pointerEvents="none"
        >
          <View style={styles.routeLoadingPill}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.routeLoadingText}>A obter rota…</Text>
          </View>
        </View>
      ) : null}

      {loading && !ride ? (
        <View style={styles.mapLoadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}

      {rideFetchFailed ? (
        <View style={[styles.mapLoadingOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]} pointerEvents="box-none">
          <View
            style={{
              borderRadius: 16,
              padding: 20,
              backgroundColor: colors.modalBg,
              maxWidth: 320,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.text, textAlign: 'center', fontWeight: '700' }}>
              Corrida não encontrada.
            </Text>
            <Pressable onPress={() => router.replace('/(tabs)' as never)} style={{ marginTop: 14, padding: 12 }}>
              <Text style={{ color: colors.accent, fontWeight: '800' }}>Voltar ao início</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showRouteOverviewFab ? (
        <Pressable
          accessibilityLabel="Visão geral da rota"
          onPress={handleRouteOverview}
          style={[
            styles.recenterFab,
            {
              bottom: Math.max(insets.bottom, 12) + 232 + (!mapFollowsDriver ? 56 : 0),
            },
          ]}
        >
          <Ionicons name="map-outline" size={22} color={colors.text} />
        </Pressable>
      ) : null}

      {!mapFollowsDriver ? (
        <Pressable
          accessibilityLabel="Centrar mapa no motorista"
          onPress={handleRecenterMap}
          style={[styles.recenterFab, { bottom: Math.max(insets.bottom, 12) + 232 }]}
        >
          <Ionicons name="locate" size={22} color={colors.text} />
        </Pressable>
      ) : null}

      <View style={[styles.navStrip, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.navStripRow}>
          <Pressable style={styles.navBackBtn} onPress={() => router.replace('/(tabs)' as never)}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.navInstruction} numberOfLines={2}>
            {maneuverHints.primary}
          </Text>
          <View style={styles.navChipsInline}>
            {liveRoute ? (
              <View style={styles.navChipCompact}>
                <Ionicons name="time-outline" size={12} color="#FFFFFF" />
                <Text style={styles.navChipTextLight}>{Math.ceil(liveRoute.durationSeconds / 60)} min</Text>
              </View>
            ) : null}
            {liveRoute ? (
              <View style={styles.navChipCompact}>
                <Ionicons name="resize-outline" size={12} color="#FFFFFF" />
                <Text style={styles.navChipTextLight}>{(liveRoute.distanceMeters / 1000).toFixed(1)} km</Text>
              </View>
            ) : null}
            {ride && ride.status === 'ontrip' ? (
              <View style={styles.navChipCompact}>
                <Text style={[styles.navChipTextLight, { fontSize: 9, opacity: 0.9 }]}>EST.</Text>
                <Text style={styles.navChipTextLight}>{formatCurrencyMzn(estimateVal)}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {maneuverHints.secondary ? (
          <View style={styles.navSecondaryLine}>
            <Text style={styles.navSecondaryText} numberOfLines={1}>
              {maneuverHints.secondary}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <InternetCallRemoteAudio stream={remoteStream} />

        <View style={styles.handle} />
        {!ride ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            {loading ? (
              <>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ marginTop: 10, color: colors.textSecondary, fontWeight: '600' }}>
                  A carregar dados da corrida…
                </Text>
              </>
            ) : null}
          </View>
        ) : null}
        {ride && primary && ['accepted', 'arriving', 'arrived', 'ontrip'].includes(ride.status) ? (
          <View style={styles.rowActions}>
            {(ride.status === 'accepted' || ride.status === 'arriving' || ride.status === 'arrived') && (
              <Pressable style={styles.callBtn} onPress={openCallOptions}>
                <Ionicons name="call" size={18} color={colors.accent} />
                <Text style={styles.callBtnText}>Ligar</Text>
              </Pressable>
            )}
            <Pressable
              style={[
                styles.primaryBtn,
                primary.danger && styles.primaryBtnDanger,
                primary.danger ? { flex: 1 } : { flex: 2 },
              ]}
              disabled={updating}
              onPress={() => {
                if (primary.onPress === 'arrived') void handleArrived();
                else if (primary.onPress === 'start') void handleStart();
                else void handleFinish();
              }}
            >
              {updating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>{primary.label}</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {ride && internetCallUi.phase !== 'idle' ? (
          <View style={styles.internetCallBanner} accessibilityLiveRegion="polite">
            <View style={styles.internetCallBannerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.internetCallLabel}>{internetCallUi.label}</Text>
                {internetCallUi.errorMessage ? (
                  <Text style={styles.internetCallSub}>{internetCallUi.errorMessage}</Text>
                ) : null}
              </View>
              {isInternetCallActive ? (
                <Pressable
                  accessibilityLabel="Terminar chamada"
                  onPress={() => void endCallByUser()}
                  style={styles.internetCallHangup}
                >
                  <Text style={styles.internetCallHangupText}>Desligar</Text>
                </Pressable>
              ) : (
                <Pressable onPress={dismissEndedBanner} style={styles.internetCallDismiss}>
                  <Text style={styles.internetCallDismissText}>Fechar</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {ride ? (
          <View style={styles.statusStrip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        ) : null}

        {ride && ride.status === 'ontrip' ? (
          <Text style={{ textAlign: 'center', fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
            {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')} · {accumulatedKm.toFixed(2)} km
          </Text>
        ) : null}
      </View>

      <Modal
        visible={callOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCallOptionsVisible(false)}
      >
        <View style={[styles.callOptionsOverlay, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setCallOptionsVisible(false)} />
          <View style={styles.callOptionsSheet}>
            <Text style={styles.callOptionsTitle}>Tipo de chamada</Text>
            <Pressable
              style={[styles.callOptionsBtn, styles.callOptionsBtnPrimary]}
              onPress={handlePickInternetCall}
              disabled={isStartingInternetCall}
            >
              <Text style={[styles.callOptionsBtnText, styles.callOptionsBtnTextPrimary]}>
                {isStartingInternetCall ? 'A iniciar…' : 'Chamada de internet'}
              </Text>
            </Pressable>
            <Pressable style={styles.callOptionsBtn} onPress={handlePickPhoneCall}>
              <Text style={styles.callOptionsBtnText}>Chamada normal</Text>
            </Pressable>
            <Pressable style={styles.callOptionsCancel} onPress={() => setCallOptionsVisible(false)}>
              <Text style={styles.callOptionsCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showSummary} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              borderRadius: 28,
              padding: 22,
              backgroundColor: colors.modalBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: colors.accentMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark-circle" size={36} color={colors.accent} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 10 }}>
                Viagem concluída!
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                Resumo oficial da corrida
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.surfaceElevated }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textMuted }}>DISTÂNCIA REAL</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text, marginTop: 4 }}>
                  {Number(completedRide?.actual_distance_km ?? 0).toFixed(2)} km
                </Text>
              </View>
              <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.surfaceElevated }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textMuted }}>TEMPO REAL</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text, marginTop: 4 }}>
                  {Math.round(Number(completedRide?.actual_duration_min ?? 0))} min
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Estimativa inicial</Text>
              <Text style={{ color: colors.text, fontWeight: '800' }}>
                {formatCurrencyMzn(
                  Number(
                    completedRide?.price_estimate ??
                      completedRide?.estimated_fare ??
                      completedRide?.fare_estimate ??
                      0,
                  ),
                )}
              </Text>
            </View>

            <View
              style={{
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.accentMuted,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '900', color: colors.accent }}>Valor final</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.accent }}>
                {formatCurrencyMzn(
                  Number(completedRide?.final_fare ?? completedRide?.fare_final ?? completedRide?.price_estimate ?? 0),
                )}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setShowSummary(false);
                router.replace('/(tabs)' as never);
              }}
              style={{
                backgroundColor: colors.accent,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.onAccent, fontWeight: '900', fontSize: 16 }}>Voltar ao início</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
