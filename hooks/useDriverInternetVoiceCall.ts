import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/realtime-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import type { MediaStream } from 'react-native-webrtc';
import { supabase } from '@/lib/supabase';
import {
  encerrarChamadaInternet,
  enviarSinalWebrtc,
  iniciarChamadaInternet,
  marcarChamadaInternetComoFalhou,
} from '@/services/internetCallRpcService';
import { getWebrtcCallPreferences } from '@/services/webrtcCallPreferences';
import { notifyWebrtcIncomingCall } from '@/services/webrtcCallNotifications';
import { startWebrtcIncomingRing, stopWebrtcIncomingRing } from '@/services/webrtcCallRing';
import { serializeIceCandidateForSignal, WebRtcVoiceSession } from '@/services/webrtcCallService';
import type { DriverInternetCallUi, RideInternetCallStatus } from '@/types/internetCall';

const IDLE_UI: DriverInternetCallUi = { phase: 'idle', label: '' };

function isRideCallStatus(s: string): s is RideInternetCallStatus {
  return (
    s === 'initiated' ||
    s === 'ringing' ||
    s === 'accepted' ||
    s === 'rejected' ||
    s === 'ended' ||
    s === 'failed' ||
    s === 'missed' ||
    s === 'cancelled'
  );
}

function labelForServerStatus(
  status: RideInternetCallStatus,
  webrtcConnected: boolean,
): { phase: DriverInternetCallUi['phase']; label: string } {
  switch (status) {
    case 'initiated':
      return { phase: 'calling', label: 'Chamando…' };
    case 'ringing':
      return { phase: 'ringing', label: 'A tocar' };
    case 'accepted':
      if (webrtcConnected) return { phase: 'in_call', label: 'Em chamada' };
      return { phase: 'connecting', label: 'A conectar…' };
    case 'rejected':
      return { phase: 'rejected_remote', label: 'Chamada recusada' };
    case 'ended':
      return { phase: 'ended', label: 'Chamada terminada' };
    case 'failed':
      return { phase: 'failed', label: 'Falha na chamada' };
    case 'missed':
      return { phase: 'missed', label: 'Chamada não atendida' };
    case 'cancelled':
      return { phase: 'cancelled', label: 'Chamada cancelada' };
    default:
      return { phase: 'idle', label: '' };
  }
}

/**
 * Modo de áudio para chamada de voz (microfone + reprodução).
 * Com `allowsRecordingIOS: true` o iOS pode encaminhar para auricular; ao terminar repõe-se `false`
 * para o utilizador ouvir notificações/altifalante de forma habitual.
 */
async function setVoiceCallAudioMode(active: boolean): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: active,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: active ? InterruptionModeIOS.DoNotMix : InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: active ? InterruptionModeAndroid.DoNotMix : InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    if (__DEV__) console.warn('[InternetCall] setAudioMode', e);
  }
}

function stopMediaStreamTracks(stream: MediaStream | null): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

type UseOpts = {
  rideId: string | undefined;
  /** auth.users.id do passageiro (receiver na RPC). */
  passengerUserId?: string | undefined;
};

export function useDriverInternetVoiceCall({ rideId, passengerUserId }: UseOpts) {
  const [ui, setUi] = useState<DriverInternetCallUi>(IDLE_UI);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  /** Mantém o último stream para cleanup explícito mesmo após React descartar o estado. */
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [isStartingInternetCall, setIsStartingInternetCall] = useState(false);

  const ringingPhaseRef = useRef(false);
  const webrtcBgNotifyRef = useRef(false);

  useEffect(() => {
    ringingPhaseRef.current = ui.phase === 'ringing';
  }, [ui.phase]);

  useEffect(() => {
    if (ui.phase !== 'ringing') {
      webrtcBgNotifyRef.current = false;
      void stopWebrtcIncomingRing();
      return;
    }
    void (async () => {
      const p = await getWebrtcCallPreferences();
      if (!p.webrtc_call_enabled) return;
      if (AppState.currentState === 'active') {
        await startWebrtcIncomingRing();
      } else if (!webrtcBgNotifyRef.current) {
        webrtcBgNotifyRef.current = true;
        await notifyWebrtcIncomingCall();
      }
    })();
  }, [ui.phase]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (!ringingPhaseRef.current) return;
      void (async () => {
        const p = await getWebrtcCallPreferences();
        if (!p.webrtc_call_enabled) return;
        if (next === 'active') {
          await stopWebrtcIncomingRing();
          await startWebrtcIncomingRing();
        } else {
          await stopWebrtcIncomingRing();
          if (!webrtcBgNotifyRef.current) {
            webrtcBgNotifyRef.current = true;
            await notifyWebrtcIncomingCall();
          }
        }
      })();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return () => {
      void stopWebrtcIncomingRing();
    };
  }, []);

  const sessionRef = useRef<WebRtcVoiceSession | null>(null);
  const callIdRef = useRef<string | null>(null);
  const signalsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callRowChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const processedSignalIdsRef = useRef<Set<string>>(new Set());
  const answerAppliedRef = useRef(false);
  const webrtcConnectedRef = useRef(false);
  const startingRef = useRef(false);
  const endingCallRef = useRef(false);

  /** Serializa teardown / cleanup / realtime (evita corrida). Erros propagam ao `await`; a fila recupera-se para a próxima operação. */
  const asyncChainRef = useRef<Promise<unknown>>(Promise.resolve());

  const runExclusive = useCallback((fn: () => Promise<void>): Promise<void> => {
    const p = asyncChainRef.current.then(() => fn());
    asyncChainRef.current = p.catch((e) => {
      if (__DEV__) console.warn('[InternetCall] fila async', e);
    });
    return p;
  }, []);

  const removeRealtimeChannels = useCallback(async () => {
    const sig = signalsChannelRef.current;
    const row = callRowChannelRef.current;
    signalsChannelRef.current = null;
    callRowChannelRef.current = null;
    try {
      if (sig) await supabase.removeChannel(sig);
    } catch {
      /* ignore */
    }
    try {
      if (row) await supabase.removeChannel(row);
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Liberta sessão de voz, streams e canais realtime sem RPC (antes de nova tentativa ou após erro parcial).
   * Usa a mesma fila que `teardown` para evitar corrida com Realtime.
   */
  const cleanupLocalPipeline = useCallback(async () => {
    return runExclusive(async () => {
      await removeRealtimeChannels();
      try {
        sessionRef.current?.dispose();
      } catch {
        /* ignore */
      }
      sessionRef.current = null;

      stopMediaStreamTracks(remoteStreamRef.current);
      remoteStreamRef.current = null;
      setRemoteStream(null);

      processedSignalIdsRef.current.clear();
      answerAppliedRef.current = false;
      webrtcConnectedRef.current = false;
      callIdRef.current = null;

      await setVoiceCallAudioMode(false);
    });
  }, [removeRealtimeChannels, runExclusive]);

  const teardown = useCallback(
    async (opts?: {
      skipRpc?: boolean;
      serverFinal?: boolean;
      endPhase?: DriverInternetCallUi['phase'];
      endLabel?: string;
      errorMessage?: string;
    }) => {
      return runExclusive(async () => {
        const cid = callIdRef.current;

        await removeRealtimeChannels();

        try {
          sessionRef.current?.dispose();
        } catch {
          /* ignore */
        }
        sessionRef.current = null;

        stopMediaStreamTracks(remoteStreamRef.current);
        remoteStreamRef.current = null;
        setRemoteStream(null);

        processedSignalIdsRef.current.clear();
        answerAppliedRef.current = false;
        webrtcConnectedRef.current = false;
        callIdRef.current = null;

        await setVoiceCallAudioMode(false);

        if (!opts?.skipRpc && cid && !opts?.serverFinal) {
          try {
            await encerrarChamadaInternet(cid);
          } catch {
            /* ignore */
          }
        }

        if (opts?.errorMessage) {
          setUi({ phase: 'failed', label: 'Falha na chamada', errorMessage: opts.errorMessage });
        } else if (opts?.endPhase && opts?.endLabel) {
          setUi({ phase: opts.endPhase, label: opts.endLabel });
        } else if (opts?.endLabel) {
          setUi({ phase: 'ended', label: opts.endLabel });
        } else {
          setUi(IDLE_UI);
        }
      });
    },
    [removeRealtimeChannels, runExclusive],
  );

  const subscribeChannels = useCallback(
    (expectedCallId: string): Promise<void> => {
      return runExclusive(async () => {
        await removeRealtimeChannels();

        const sigCh = supabase
          .channel(`ride-call-signals-${expectedCallId}-${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'ride_call_signals',
              filter: `call_id=eq.${expectedCallId}`,
            },
            (payload) => {
              if (callIdRef.current !== expectedCallId) return;

              const row = payload.new as Record<string, unknown>;
              const sid = row.id != null ? String(row.id) : null;

              const signalType = row.signal_type != null ? String(row.signal_type) : '';
              const rawPayload = row.payload;
              const pl =
                rawPayload && typeof rawPayload === 'object' ? (rawPayload as Record<string, unknown>) : {};

              if (signalType !== 'answer' && signalType !== 'ice_candidate') {
                return;
              }

              if (signalType === 'answer') {
                if (answerAppliedRef.current) return;
              } else if (sid && processedSignalIdsRef.current.has(sid)) {
                return;
              }

              void (async () => {
                if (callIdRef.current !== expectedCallId) return;
                const sess = sessionRef.current;
                if (!sess || sess.ended) return;

                try {
                  if (signalType === 'answer') {
                    await sess.setRemoteAnswer({
                      type: pl.type != null ? String(pl.type) : undefined,
                      sdp: pl.sdp != null ? String(pl.sdp) : undefined,
                    });
                    answerAppliedRef.current = true;
                    if (sid) processedSignalIdsRef.current.add(sid);
                    setUi((u) => ({
                      ...u,
                      phase: webrtcConnectedRef.current ? 'in_call' : 'connecting',
                      label: webrtcConnectedRef.current ? 'Em chamada' : 'A conectar…',
                    }));
                  } else if (signalType === 'ice_candidate') {
                    await sess.addRemoteIceCandidate(pl);
                    if (sid) processedSignalIdsRef.current.add(sid);
                  }
                } catch (e) {
                  if (__DEV__) console.warn('[InternetCall] signal', e);
                }
              })();
            },
          )
          .subscribe((status, err) => {
            if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR && __DEV__) {
              console.warn('[InternetCall] ride_call_signals channel', err);
            }
          });
        signalsChannelRef.current = sigCh;

        const rowCh = supabase
          .channel(`ride-calls-${expectedCallId}-${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'ride_calls',
              filter: `id=eq.${expectedCallId}`,
            },
            (payload) => {
              if (callIdRef.current !== expectedCallId) return;

              const row = payload.new as Record<string, unknown> | null;
              const st = row?.status != null ? String(row.status) : '';
              if (!st || !isRideCallStatus(st)) return;

              const { phase, label } = labelForServerStatus(st, webrtcConnectedRef.current);
              setUi((prev) => ({ ...prev, phase, label }));

              if (
                st === 'rejected' ||
                st === 'ended' ||
                st === 'failed' ||
                st === 'missed' ||
                st === 'cancelled'
              ) {
                void teardown({
                  skipRpc: true,
                  serverFinal: true,
                  endPhase: phase,
                  endLabel: label,
                });
              }
            },
          )
          .subscribe((status, err) => {
            if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR && __DEV__) {
              console.warn('[InternetCall] ride_calls channel', err);
            }
          });
        callRowChannelRef.current = rowCh;
      });
    },
    [removeRealtimeChannels, runExclusive, teardown],
  );

  const endCallByUser = useCallback(async () => {
    if (endingCallRef.current) return;
    endingCallRef.current = true;
    try {
      await teardown();
    } finally {
      endingCallRef.current = false;
    }
  }, [teardown]);

  const startInternetCall = useCallback(async () => {
    if (!rideId?.trim() || startingRef.current) return;
    if (Platform.OS === 'web') {
      Alert.alert('Indisponível', 'A chamada por voz requer a aplicação no telemóvel.');
      return;
    }
    if (sessionRef.current && !sessionRef.current.ended) {
      Alert.alert('Chamada', 'Já existe uma chamada em curso.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id?.trim()) {
      Alert.alert('Erro', 'Inicie sessão para ligar.');
      return;
    }

    const receiverUserId =
      passengerUserId?.trim() ||
      '';
    if (!receiverUserId) {
      Alert.alert(
        'Indisponível',
        'Não foi possível obter o utilizador (auth) do passageiro. Peça à API para expor user_id ou passenger_user_id na resposta.',
      );
      return;
    }

    startingRef.current = true;
    setIsStartingInternetCall(true);
    webrtcConnectedRef.current = false;
    answerAppliedRef.current = false;
    processedSignalIdsRef.current.clear();

    let callId: string | null = null;

    try {
      await cleanupLocalPipeline();

      setUi({ phase: 'calling', label: 'Chamando…' });
      const { call_id } = await iniciarChamadaInternet({
        p_ride_id: rideId,
        p_caller_user_id: user.id,
        p_receiver_user_id: receiverUserId,
        p_call_mode: 'internet_voice',
      });
      if (!call_id?.trim()) {
        throw new Error('Servidor não devolveu call_id.');
      }
      callId = call_id;
      callIdRef.current = callId;

      await setVoiceCallAudioMode(true);

      const session = new WebRtcVoiceSession({
        onRemoteStream: (stream) => {
          remoteStreamRef.current = stream;
          setRemoteStream(stream);
        },
        onConnectionState: (state) => {
          if (state === 'connected') {
            webrtcConnectedRef.current = true;
            setUi((u) => ({ ...u, phase: 'in_call', label: 'Em chamada' }));
          } else if (state === 'failed') {
            if (callIdRef.current) {
              void marcarChamadaInternetComoFalhou(callIdRef.current).catch(() => {});
            }
            void teardown({ errorMessage: 'Ligação interrompida.' });
          }
        },
        onIceCandidate: (candidate) => {
          const cid = callIdRef.current;
          if (!cid) return;
          const payload = serializeIceCandidateForSignal(candidate);
          void enviarSinalWebrtc(cid, 'ice_candidate', payload).catch((e) => {
            if (__DEV__) console.warn('[InternetCall] enviar ICE', e);
          });
        },
      });

      sessionRef.current = session;
      await subscribeChannels(callId);

      const offer = await session.createMicStreamAndOffer();
      await enviarSinalWebrtc(callId, 'offer', { type: offer.type, sdp: offer.sdp });
    } catch (e: unknown) {
      console.log('Erro completo:', e);
      const rawMsg =
        e != null &&
        typeof e === 'object' &&
        'message' in e &&
        (e as { message?: unknown }).message != null &&
        String((e as { message?: unknown }).message).trim() !== ''
          ? String((e as { message: string }).message)
          : JSON.stringify(e);
      const msg = e instanceof Error ? e.message : rawMsg;
      const friendly =
        msg.includes('Permission') || msg.toLowerCase().includes('permission')
          ? 'É necessário permitir o microfone para esta chamada.'
          : msg.includes('NotAllowedError') || msg.includes('denied')
            ? 'Microfone negado. Ative as permissões nas definições do sistema.'
            : `Não foi possível iniciar a chamada. ${rawMsg}`;

      if (callId) {
        try {
          await marcarChamadaInternetComoFalhou(callId);
        } catch {
          /* ignore */
        }
      }
      await teardown({ errorMessage: friendly });
      Alert.alert('Chamada', friendly);
    } finally {
      startingRef.current = false;
      setIsStartingInternetCall(false);
    }
  }, [rideId, passengerUserId, subscribeChannels, teardown, cleanupLocalPipeline]);

  const teardownRef = useRef(teardown);
  teardownRef.current = teardown;
  useEffect(() => {
    return () => {
      void teardownRef.current({ skipRpc: false });
    };
  }, []);

  const dismissEndedBanner = useCallback(() => {
    setUi(IDLE_UI);
  }, []);

  const isInternetCallActive =
    ui.phase === 'calling' ||
    ui.phase === 'ringing' ||
    ui.phase === 'connecting' ||
    ui.phase === 'in_call';

  return {
    internetCallUi: ui,
    remoteStream,
    startInternetCall,
    endCallByUser,
    dismissEndedBanner,
    isInternetCallActive,
    isStartingInternetCall,
  };
}

