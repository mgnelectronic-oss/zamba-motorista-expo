import { registerGlobals } from 'react-native-webrtc';

/**
 * Obrigatório antes de `mediaDevices.getUserMedia` / `RTCPeerConnection`.
 * Chamada única por processo.
 *
 * Nota: `react-native-webrtc` exige módulos nativos — usar development build / `expo prebuild`
 * (não disponível no Expo Go). O plugin `@config-plugins/react-native-webrtc` trata do projeto nativo.
 */
let done = false;

export function ensureWebRtcGlobals(): void {
  if (done) return;
  registerGlobals();
  done = true;
}
