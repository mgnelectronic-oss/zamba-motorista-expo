import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { driverService } from '@/services/driverService';
import { getBestDriverCoordinates, LIVE_ROUTE_LOG_TAG, syncLiveRouteFromServer } from '@/services/routeService';
import { playRideAlertSoundWithUserPrefs, stopRideAlert } from '@/services/rideAlert';
import { stopWebrtcIncomingRing } from '@/services/webrtcCallRing';
import { getRideAlertPreferences } from '@/services/rideAlertPreferences';
import { notifyNewRideOfferLocal } from '@/services/rideOfferNotifications';
import { updateRideStatusAndTriggerNotifications } from '@/services/rideStatusNotifications';
import type { ActiveOfferUI } from '@/types/rideFlow';

export type PickupNavParams = { lat: number; lng: number };

type UseDriverOffersOptions = {
  userId: string | undefined;
  driverId: string | null | undefined;
  /** online, aprovado e sem corrida ativa */
  listening: boolean;
  onAcceptedGoToRide: (rideId: string, pickup?: PickupNavParams) => void;
};

const TERMINAL = new Set(['accepted', 'rejected', 'expired']);

function isTruthyAlertTriggered(row: Record<string, unknown>): boolean {
  return row.alert_triggered === true;
}

/**
 * Subscrição `ride_offers` (INSERT/UPDATE/DELETE) + som/vibração ou notificação local.
 */
export function useDriverOffers({ userId, driverId, listening, onAcceptedGoToRide }: UseDriverOffersOptions) {
  const [activeOffer, setActiveOffer] = useState<ActiveOfferUI | null>(null);
  const [responding, setResponding] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const offerIdRef = useRef<string | null>(null);
  const activeOfferRef = useRef<ActiveOfferUI | null>(null);
  offerIdRef.current = activeOffer?.id ?? null;
  activeOfferRef.current = activeOffer;

  const clearOffer = useCallback(() => {
    void stopWebrtcIncomingRing();
    void stopRideAlert();
    setActiveOffer(null);
  }, []);

  const onOfferRow = useCallback(
    async (row: Record<string, unknown>) => {
      if (!row.id) return;
      const id = String(row.id);
      const status = String(row.status ?? '');

      if (TERMINAL.has(status)) {
        if (offerIdRef.current === id) {
          void stopRideAlert();
          setActiveOffer(null);
        }
        return;
      }

      if (status !== 'pending') return;

      const minimal = driverService.buildMinimalOfferUiFromRow(row);
      if (!minimal) return;
      const exp = new Date(minimal.expiresAt).getTime();
      if (exp <= Date.now()) {
        if (offerIdRef.current === minimal.id) setActiveOffer(null);
        return;
      }

      setActiveOffer(minimal);

      void driverService.hydrateOfferForUi(row).then((full) => {
        if (full && offerIdRef.current === full.id) setActiveOffer(full);
      });

      const runForegroundAlert = async () => {
        void stopWebrtcIncomingRing();
        await playRideAlertSoundWithUserPrefs();
      };

      if (isTruthyAlertTriggered(row)) {
        console.log('Nova corrida recebida', { offerId: minimal.id, path: 'alert_triggered' });
        const pSync = await getRideAlertPreferences();
        if (!pSync.notifications_enabled) void stopRideAlert();
        else if (AppState.currentState === 'active') {
          await runForegroundAlert();
        }
        return;
      }

      const claimed = await driverService.claimOfferAlert(id);
      console.log('Nova corrida recebida', { offerId: minimal.id, claimed });

      if (!claimed) {
        const prefsNc = await getRideAlertPreferences();
        if (prefsNc.notifications_enabled && AppState.currentState === 'active') {
          await runForegroundAlert();
        }
        return;
      }

      const prefs = await getRideAlertPreferences();
      if (!prefs.notifications_enabled) {
        void stopRideAlert();
        return;
      }

      if (AppState.currentState === 'active') {
        await runForegroundAlert();
      } else {
        await notifyNewRideOfferLocal();
      }
    },
    [],
  );

  const loadPending = useCallback(async () => {
    if (!driverId) return;
    const pending = await driverService.getPendingOffer(driverId);
    if (!pending) {
      setActiveOffer(null);
      return;
    }
    const { offer, ride } = pending;
    const quick = driverService.syncOfferUiFromOfferAndRide(offer, ride);
    if (!quick || quick.status !== 'pending') {
      setActiveOffer(null);
      return;
    }
    const exp = new Date(quick.expiresAt).getTime();
    if (exp <= Date.now()) {
      setActiveOffer(null);
      return;
    }

    setActiveOffer(quick);

    void driverService.hydrateOfferForUi(offer, ride).then((full) => {
      if (full && offerIdRef.current === full.id) setActiveOffer(full);
    });

    const runForegroundAlert = async () => {
      void stopWebrtcIncomingRing();
      await playRideAlertSoundWithUserPrefs();
    };

    console.log('Nova corrida recebida', { offerId: quick.id, source: 'loadPending' });

    if (isTruthyAlertTriggered(offer as Record<string, unknown>)) {
      const prefs = await getRideAlertPreferences();
      if (!prefs.notifications_enabled) void stopRideAlert();
      else if (AppState.currentState === 'active') {
        await runForegroundAlert();
      }
      return;
    }

    const claimed = await driverService.claimOfferAlert(quick.id);
    if (!claimed) {
      const prefsNc = await getRideAlertPreferences();
      if (prefsNc.notifications_enabled && AppState.currentState === 'active') {
        await runForegroundAlert();
      }
      return;
    }

    const prefs = await getRideAlertPreferences();
    if (!prefs.notifications_enabled) {
      void stopRideAlert();
      return;
    }

    if (AppState.currentState === 'active') {
      await runForegroundAlert();
    } else {
      await notifyNewRideOfferLocal();
    }
  }, [driverId]);

  const onOfferExpireSound = useCallback(() => {
    void stopRideAlert();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const pending = activeOfferRef.current;
      if (!pending || pending.status !== 'pending') return;

      if (next === 'active') {
        void stopWebrtcIncomingRing();
        void playRideAlertSoundWithUserPrefs();
      } else {
        void stopRideAlert();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!listening || !driverId || !userId) {
      void stopRideAlert();
      setActiveOffer(null);
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    void loadPending();

    const channelName = `driver-offers-${driverId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ride_offers',
          filter: `driver_id=eq.${driverId}`,
        },
        async (payload) => {
          const eventType = (payload as { eventType?: string }).eventType ?? '';

          if (eventType === 'DELETE') {
            const oldRow = (payload as { old?: Record<string, unknown> }).old;
            if (oldRow?.id && offerIdRef.current === String(oldRow.id)) {
              void stopRideAlert();
              setActiveOffer(null);
            }
            return;
          }

          const row = (payload as { new?: Record<string, unknown> }).new;
          if (!row) return;

          await onOfferRow(row);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      void stopRideAlert();
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [listening, driverId, userId, loadPending, onOfferRow]);

  const accept = useCallback(async () => {
    if (!activeOffer || !userId || responding) return;
    setResponding(true);
    try {
      const { data, error } = await supabase.rpc('accept_ride_offer', { p_offer_id: activeOffer.id });
      if (error) throw error;

      let rideId: string | null = null;
      if (typeof data === 'string' && data.length > 0) rideId = data;
      else if (Array.isArray(data) && data.length > 0) {
        const first = data[0] as unknown;
        if (typeof first === 'string') rideId = first;
        else if (first && typeof first === 'object') {
          const o = first as Record<string, unknown>;
          rideId = (o.ride_id as string) || (o.id as string) || null;
        }
      } else if (data && typeof data === 'object') {
        const o = data as Record<string, unknown>;
        rideId = (o.ride_id as string) || (o.id as string) || null;
      }
      if (!rideId) rideId = activeOffer.rideId;
      if (rideId) {
        const pushRes = await updateRideStatusAndTriggerNotifications(rideId, 'accepted', {
          ifAlreadyStatus: 'invoke_push_only',
        });
        if (pushRes.error) {
          console.warn('[useDriverOffers] accepted → push queue', pushRes.error);
        }
      }

      const pickupSnapshot =
        Number.isFinite(activeOffer.pickup_lat) && Number.isFinite(activeOffer.pickup_lng)
          ? { lat: activeOffer.pickup_lat, lng: activeOffer.pickup_lng }
          : undefined;

      await driverService.setBusyStatus(userId, true);
      clearOffer();

      try {
        const coords = await getBestDriverCoordinates();
        if (coords) {
          console.log(LIVE_ROUTE_LOG_TAG, 'useDriverOffers.ts: aceite → recálculo rota recolha', {
            ride_id: rideId,
            ...coords,
          });
          await syncLiveRouteFromServer(rideId, coords.driver_lat, coords.driver_lng, { force: true });
        } else {
          console.error(
            LIVE_ROUTE_LOG_TAG,
            'useDriverOffers: ACEITE sem coordenadas — Edge Function não chamada (ativar GPS / permissões). ride_id=',
            rideId,
          );
        }
      } catch (e) {
        console.error(LIVE_ROUTE_LOG_TAG, 'useDriverOffers: falha ao obter rota após aceite', e);
      }

      onAcceptedGoToRide(rideId, pickupSnapshot);
    } finally {
      setResponding(false);
    }
  }, [activeOffer, userId, responding, clearOffer, onAcceptedGoToRide]);

  const reject = useCallback(async () => {
    if (!activeOffer || responding) return;
    setResponding(true);
    try {
      await driverService.respondToOffer(activeOffer.id, 'rejected');
      clearOffer();
    } catch {
      clearOffer();
    } finally {
      setResponding(false);
    }
  }, [activeOffer, responding, clearOffer]);

  return {
    activeOffer,
    responding,
    accept,
    reject,
    reloadPending: loadPending,
    dismissOffer: clearOffer,
    onOfferExpireSound,
  };
}
