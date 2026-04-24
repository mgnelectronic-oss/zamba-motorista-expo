import type { MediaStream, RTCIceCandidate } from 'react-native-webrtc';
import {
  mediaDevices,
  RTCIceCandidate as RTCIceCandidateCtor,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { ensureWebRtcGlobals } from '@/lib/webrtcGlobals';

/**
 * ICE: STUN público na fase 1. Incluir servidores TURN aqui quando existirem credenciais no backend.
 */
const DEFAULT_ICE_SERVERS: RTCConfiguration['iceServers'] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type WebRtcConnectionState = RTCPeerConnectionState;

export type WebRtcVoiceSessionOptions = {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionState: (state: WebRtcConnectionState) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
};

/** Serializa candidato ICE para `enviar_sinal_webrtc(..., 'ice_candidate', payload)`. */
export function serializeIceCandidateForSignal(candidate: RTCIceCandidate): Record<string, unknown> {
  try {
    const j = (candidate as unknown as { toJSON?: () => Record<string, unknown> }).toJSON?.();
    if (j && typeof j === 'object') return j;
  } catch {
    /* fallback */
  }
  return {
    candidate: candidate.candidate ?? '',
    sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
    sdpMid: candidate.sdpMid ?? null,
  };
}

/**
 * Sessão de áudio da chamada de internet (lado que cria a oferta — motorista).
 * Uma instância por chamada; chamar `dispose()` antes de iniciar outra.
 *
 * Requer development build com `react-native-webrtc` (não disponível no Expo Go).
 */
export class WebRtcVoiceSession {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  /** Guardado para parar tracks remotas em `dispose` (evita microfone/altifalante “presos”). */
  private remoteStream: MediaStream | null = null;
  private disposed = false;
  private readonly opts: WebRtcVoiceSessionOptions;
  private readonly pendingRemoteIce: Record<string, unknown>[] = [];
  /** Remove listeners do peer antes de `close()` (evita referências órfãs). */
  private detachPeerListeners: (() => void) | null = null;

  constructor(opts: WebRtcVoiceSessionOptions) {
    this.opts = opts;
  }

  /**
   * Obtém microfone, cria `RTCPeerConnection`, adiciona track, gera e aplica offer local.
   * Retorna o SDP a enviar ao par via `enviar_sinal_webrtc(..., 'offer', ...)`.
   */
  async createMicStreamAndOffer(): Promise<{ type: string; sdp: string }> {
    ensureWebRtcGlobals();
    if (this.disposed) throw new Error('A chamada de internet já terminou.');

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    this.localStream = stream;

    const pc = new RTCPeerConnection({
      iceServers: DEFAULT_ICE_SERVERS,
    });
    this.pc = pc;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    /** `addEventListener` existe na implementação (EventTarget); o tipo pode colidir com `lib.dom`. */
    const pcEv = pc as unknown as {
      addEventListener(
        type: 'icecandidate' | 'track' | 'connectionstatechange',
        listener: (ev: unknown) => void,
      ): void;
      removeEventListener(
        type: 'icecandidate' | 'track' | 'connectionstatechange',
        listener: (ev: unknown) => void,
      ): void;
    };

    const onIce = (ev: unknown) => {
      const candidate = (ev as { candidate: RTCIceCandidate | null }).candidate;
      if (this.disposed) return;
      if (!candidate) return;
      this.opts.onIceCandidate(candidate);
    };

    const onTrack = (ev: unknown) => {
      const streams = (ev as { streams: MediaStream[] }).streams;
      const rs = streams[0];
      if (rs) {
        this.remoteStream = rs;
        this.opts.onRemoteStream(rs);
      }
    };

    const onConn = () => {
      if (this.pc) this.opts.onConnectionState(this.pc.connectionState);
    };

    pcEv.addEventListener('icecandidate', onIce);
    pcEv.addEventListener('track', onTrack);
    pcEv.addEventListener('connectionstatechange', onConn);

    this.detachPeerListeners = () => {
      try {
        pcEv.removeEventListener('icecandidate', onIce);
        pcEv.removeEventListener('track', onTrack);
        pcEv.removeEventListener('connectionstatechange', onConn);
      } catch {
        /* ignore */
      }
    };

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
    } catch (e) {
      this.dispose();
      throw e;
    }

    const d = pc.localDescription;
    if (!d?.sdp || !d.type) {
      this.dispose();
      throw new Error('Offer SDP inválido.');
    }
    return { type: d.type, sdp: d.sdp };
  }

  async setRemoteAnswer(payload: { type?: string; sdp?: string }): Promise<void> {
    if (this.disposed || !this.pc) return;
    if (this.pc.remoteDescription) return;
    if (!payload.sdp || !payload.type) return;
    await this.pc.setRemoteDescription(
      new RTCSessionDescription({
        type: payload.type,
        sdp: payload.sdp,
      }),
    );
    await this.flushPendingRemoteIce();
  }

  private async flushPendingRemoteIce(): Promise<void> {
    if (!this.pc || this.disposed) return;
    const batch = [...this.pendingRemoteIce];
    this.pendingRemoteIce.length = 0;
    for (const payload of batch) {
      await this.addRemoteIceCandidateInternal(payload);
    }
  }

  async addRemoteIceCandidate(payload: Record<string, unknown>): Promise<void> {
    if (this.disposed || !this.pc) return;
    if (!this.pc.remoteDescription) {
      this.pendingRemoteIce.push(payload);
      return;
    }
    await this.addRemoteIceCandidateInternal(payload);
  }

  private async addRemoteIceCandidateInternal(payload: Record<string, unknown>): Promise<void> {
    if (this.disposed || !this.pc) return;

    const candRaw = payload.candidate;
    if (candRaw === null || candRaw === undefined) return;
    const candStr = typeof candRaw === 'string' ? candRaw.trim() : String(candRaw).trim();
    if (!candStr) return;

    try {
      const sdpMLineIndex =
        typeof payload.sdpMLineIndex === 'number'
          ? payload.sdpMLineIndex
          : typeof payload.sdpMLineIndex === 'string'
            ? parseInt(payload.sdpMLineIndex, 10)
            : 0;
      const sdpMid =
        typeof payload.sdpMid === 'string'
          ? payload.sdpMid
          : payload.sdpMid === null
            ? null
            : undefined;

      const ice = new RTCIceCandidateCtor({
        candidate: candStr,
        sdpMLineIndex: Number.isFinite(sdpMLineIndex) ? sdpMLineIndex : 0,
        sdpMid: sdpMid ?? null,
      });
      await this.pc.addIceCandidate(ice);
    } catch (e) {
      if (__DEV__) console.warn('[WebRtcVoiceSession] addIceCandidate', e);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pendingRemoteIce.length = 0;

    try {
      this.detachPeerListeners?.();
    } catch {
      /* ignore */
    }
    this.detachPeerListeners = null;

    try {
      this.remoteStream?.getTracks().forEach((t) => {
        t.stop();
      });
    } catch {
      /* ignore */
    }
    this.remoteStream = null;

    try {
      this.localStream?.getTracks().forEach((t) => {
        t.stop();
      });
    } catch {
      /* ignore */
    }
    this.localStream = null;

    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
  }

  get ended(): boolean {
    return this.disposed;
  }
}
