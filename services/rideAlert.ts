import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Platform, Vibration } from 'react-native';
import type { RideSoundId } from '@/constants/rideSounds';
import { RIDE_SOUND_MODULES } from '@/constants/rideSounds';
import { getRideAlertPreferences } from '@/services/rideAlertPreferences';
import {
  playPreview as playAlertPreview,
  stopPreview,
} from '@/services/rideAlertPreviewController';

let loopingSound: Audio.Sound | null = null;
let iosVibrateTimer: ReturnType<typeof setInterval> | null = null;

const FALLBACK_SOUND: RideSoundId = 'flow';

function stopIosVibrateLoop(): void {
  if (iosVibrateTimer != null) {
    clearInterval(iosVibrateTimer);
    iosVibrateTimer = null;
  }
}

function startIosVibrateLoop(): void {
  stopIosVibrateLoop();
  Vibration.vibrate(500);
  iosVibrateTimer = setInterval(() => {
    Vibration.vibrate(500);
  }, 800);
}

async function configureRideAlertAudioMode(): Promise<void> {
  try {
    await Audio.setIsEnabledAsync(true);
  } catch {
    /* noop */
  }
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    if (__DEV__) console.warn('[rideAlert] setAudioModeAsync', e);
  }
}

export { stopPreview as stopRideAlertPreview } from '@/services/rideAlertPreviewController';

/**
 * Teste na UI: para alerta real e toca pré-visualização ~2,6s (reinicia se já a tocar).
 */
export async function playRideAlertPreview(soundId: RideSoundId, volumePercent: number): Promise<void> {
  await stopRideAlert();
  await playAlertPreview(soundId, volumePercent, { isLooping: true, autoStopMs: 2600 });
}

export type RideAlertPlaybackOptions = {
  soundId: RideSoundId;
  /** 0–100 */
  volumePercent: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
};

/**
 * Alerta de nova corrida (foreground): para o anterior, configura áudio, toca em loop até `stopRideAlert`.
 * Ordem: som → vibração (modal/ UI deve ser mostrada depois desta Promise resolver).
 */
export async function playRideAlertSound(options: RideAlertPlaybackOptions): Promise<void> {
  await stopRideAlert();
  await configureRideAlertAudioMode();

  const vol = options.soundEnabled ? Math.max(0, Math.min(1, options.volumePercent / 100)) : 0;

  const resolvedSoundId: RideSoundId =
    options.soundId && RIDE_SOUND_MODULES[options.soundId] ? options.soundId : FALLBACK_SOUND;

  if (options.soundEnabled && vol > 0) {
    try {
      const mod = RIDE_SOUND_MODULES[resolvedSoundId];
      const { sound } = await Audio.Sound.createAsync(mod, {
        shouldPlay: false,
        volume: vol,
        isLooping: true,
      });
      loopingSound = sound;
      await loopingSound.setVolumeAsync(vol);
      await loopingSound.setIsLoopingAsync(true);
      console.log('Tocando som', { soundId: resolvedSoundId, volumePercent: options.volumePercent });
      await loopingSound.playAsync();
    } catch (e) {
      console.warn('[rideAlert] erro ao criar/reproduzir som', e);
    }
  }

  if (options.vibrationEnabled) {
    if (Platform.OS === 'android') {
      Vibration.cancel();
      Vibration.vibrate([0, 500, 500], true);
    } else {
      Vibration.cancel();
      startIosVibrateLoop();
    }
  } else {
    Vibration.cancel();
    stopIosVibrateLoop();
  }
}

/** Lê preferências e aplica som + vibração (app em primeiro plano). */
export async function playRideAlertSoundWithUserPrefs(): Promise<void> {
  const p = await getRideAlertPreferences();
  if (!p.notifications_enabled) return;
  return playRideAlertSound({
    soundId: p.notification_sound,
    volumePercent: p.alert_volume,
    soundEnabled: p.sound_enabled,
    vibrationEnabled: p.vibration_enabled,
  });
}

/** @deprecated usar playRideAlertSound */
export const startRideAlert = playRideAlertSound;

/** @deprecated usar playRideAlertSoundWithUserPrefs */
export const startRideAlertWithUserPrefs = playRideAlertSoundWithUserPrefs;

/** Para loop de corrida e pré-visualização; cancela vibração. */
export async function stopRideAlert(): Promise<void> {
  await stopPreview();
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
