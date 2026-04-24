import { Audio } from 'expo-av';

import { Platform, Vibration } from 'react-native';

import type { WebrtcCallSoundId } from '@/constants/webrtcCallSounds';

import { RINGTONE_SOUND_MODULES } from '@/constants/ringtoneCatalog';

import { getWebrtcCallPreferences } from '@/services/webrtcCallPreferences';

import { playRingtonePreview, stopRingtonePreview } from '@/services/ringtonePreviewAudio';

import { stopRideAlert } from '@/services/rideAlert';



let loopingSound: Audio.Sound | null = null;

let iosVibrateTimer: ReturnType<typeof setInterval> | null = null;



function stopIosVibrateLoop(): void {

  if (iosVibrateTimer != null) {

    clearInterval(iosVibrateTimer);

    iosVibrateTimer = null;

  }

}



function startIosVibrateLoop(): void {

  stopIosVibrateLoop();

  Vibration.vibrate(400);

  iosVibrateTimer = setInterval(() => {

    Vibration.vibrate(400);

  }, 700);

}



async function configureRingAudioMode(): Promise<void> {

  try {

    await Audio.setAudioModeAsync({

      allowsRecordingIOS: false,

      staysActiveInBackground: false,

      playsInSilentModeIOS: true,

      shouldDuckAndroid: false,

      playThroughEarpieceAndroid: false,

    });

  } catch {

    /* noop */

  }

}



export async function stopWebrtcRingPreview(): Promise<void> {

  await stopRingtonePreview();

}



/**

 * Toque de chamada contínuo (fase a tocar). Para alertas de corrida para evitar dois sons.

 */

export async function startWebrtcIncomingRing(): Promise<void> {

  await stopWebrtcIncomingRing();

  void stopRideAlert();



  const p = await getWebrtcCallPreferences();

  if (!p.webrtc_call_enabled) return;



  const vol = Math.max(0, Math.min(1, p.webrtc_call_volume / 100));



  if (vol > 0) {

    await configureRingAudioMode();

    try {

      const mod = RINGTONE_SOUND_MODULES[p.call_sound];

      const { sound } = await Audio.Sound.createAsync(mod, {

        shouldPlay: false,

        volume: vol,

        isLooping: true,

      });

      loopingSound = sound;

      await loopingSound.setVolumeAsync(vol);

      await loopingSound.setIsLoopingAsync(true);

      await loopingSound.playAsync();

    } catch (e) {

      if (__DEV__) console.warn('[webrtcCallRing]', e);

    }

  }



  if (p.webrtc_call_vibration) {

    if (Platform.OS === 'android') {

      Vibration.cancel();

      Vibration.vibrate([0, 400, 300], true);

    } else {

      Vibration.cancel();

      startIosVibrateLoop();

    }

  } else {

    Vibration.cancel();

    stopIosVibrateLoop();

  }

}



/** Para loop de chamada e preview. */

export async function stopWebrtcIncomingRing(): Promise<void> {

  await stopWebrtcRingPreview();

  stopIosVibrateLoop();

  try {

    Vibration.cancel();

  } catch {

    /* noop */

  }

  if (loopingSound) {

    try {

      await loopingSound.stopAsync();

    } catch {

      /* noop */

    }

    try {

      await loopingSound.unloadAsync();

    } catch {

      /* noop */

    }

    loopingSound = null;

  }

}



export type WebrtcRingSoundPreviewOptions = {
  volumePercent?: number;
  onEnd?: () => void;
};

/**
 * Pré-visualização (lista / slider) — até ao fim do ficheiro; mesmo slot que corrida (`ringtonePreviewAudio`).
 */
export async function startWebrtcRingSoundPreview(
  soundId: WebrtcCallSoundId,
  options?: WebrtcRingSoundPreviewOptions,
): Promise<void> {
  const p = await getWebrtcCallPreferences();
  const volPct = options?.volumePercent !== undefined ? options.volumePercent : p.webrtc_call_volume;
  const vol = Math.max(0, Math.min(1, volPct / 100));

  if (vol <= 0) {
    await stopRingtonePreview();
    options?.onEnd?.();
    return;
  }

  await playRingtonePreview(soundId, volPct, {
    playUntilEnd: true,
    onEnd: options?.onEnd,
  });
}


