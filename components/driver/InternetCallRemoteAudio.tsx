import React, { useMemo } from 'react';
import { View } from 'react-native';
import type { MediaStream } from 'react-native-webrtc';
import { RTCView } from 'react-native-webrtc';

type Props = {
  stream: MediaStream | null;
};

/**
 * Reprodução do áudio remoto da chamada de internet: em muitos dispositivos o som só é ativado com um `RTCView`
 * ligado ao `streamURL` (áudio-only, view mínima e invisível).
 *
 * Requer **development build** com `react-native-webrtc` nativo (não funciona no Expo Go).
 */
export const InternetCallRemoteAudio = React.memo(function InternetCallRemoteAudio({ stream }: Props) {
  const streamUrl = useMemo(() => {
    if (!stream || typeof stream.toURL !== 'function') return null;
    return stream.toURL();
  }, [stream]);

  if (!streamUrl) return null;

  return (
    <View pointerEvents="none" style={{ width: 0, height: 0, overflow: 'hidden' }}>
      <RTCView
        key={streamUrl}
        streamURL={streamUrl}
        style={{ width: 1, height: 1, opacity: 0.01 }}
        objectFit="cover"
      />
    </View>
  );
});
