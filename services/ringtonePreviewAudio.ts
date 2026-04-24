import { Audio } from 'expo-av';
import type { RingtoneId } from '@/constants/ringtoneCatalog';
import { RINGTONE_SOUND_MODULES } from '@/constants/ringtoneCatalog';

/** Uma única instância de pré-visualização para corrida, chamadas de internet e sliders. */
let previewSound: Audio.Sound | null = null;
let autoStopTimer: ReturnType<typeof setTimeout> | null = null;

function clearAutoStop(): void {
  if (autoStopTimer != null) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
}

async function configureAudioMode(): Promise<void> {
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

export async function stopRingtonePreview(): Promise<void> {
  clearAutoStop();
  if (previewSound) {
    try {
      await previewSound.stopAsync();
    } catch {
      /* noop */
    }
    try {
      previewSound.setOnPlaybackStatusUpdate(null);
    } catch {
      /* noop */
    }
    try {
      await previewSound.unloadAsync();
    } catch {
      /* noop */
    }
    previewSound = null;
  }
}

export type RingtonePreviewPlayOptions = {
  isLooping?: boolean;
  /**
   * Corta após N ms (fluxos compactos). Omitir com `playUntilEnd` para não usar timer.
   */
  autoStopMs?: number;
  /**
   * Uma reprodução linear até ao fim do ficheiro — sem `setTimeout`, sem corte antes do fim.
   */
  playUntilEnd?: boolean;
  onEnd?: () => void;
};

function attachPlayUntilEndListener(sound: Audio.Sound, onEnd?: () => void): void {
  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded || !status.didJustFinish) return;
    void (async () => {
      if (previewSound !== sound) return;
      previewSound = null;
      try {
        sound.setOnPlaybackStatusUpdate(null);
      } catch {
        /* noop */
      }
      try {
        await sound.unloadAsync();
      } catch {
        /* noop */
      }
      onEnd?.();
    })();
  });
}

/**
 * Pré-visualização única: para o anterior, depois toca (expo-av).
 * Com `playUntilEnd`, não há limite artificial de duração.
 */
export async function playRingtonePreview(
  soundId: RingtoneId,
  volumePercent: number,
  options?: RingtonePreviewPlayOptions,
): Promise<void> {
  const vol = Math.max(0, Math.min(1, volumePercent / 100));
  if (vol <= 0) {
    await stopRingtonePreview();
    options?.onEnd?.();
    return;
  }

  await stopRingtonePreview();
  await configureAudioMode();

  const playUntilEnd = options?.playUntilEnd === true;
  const isLooping = playUntilEnd ? false : (options?.isLooping ?? true);
  const onEnd = options?.onEnd;

  try {
    const mod = RINGTONE_SOUND_MODULES[soundId];
    const { sound } = await Audio.Sound.createAsync(mod, {
      shouldPlay: false,
      volume: vol,
      isLooping,
    });
    previewSound = sound;
    await previewSound.setVolumeAsync(vol);
    await previewSound.setIsLoopingAsync(isLooping);
    await previewSound.playAsync();

    clearAutoStop();

    if (playUntilEnd) {
      attachPlayUntilEndListener(sound, onEnd);
      return;
    }

    const autoStopMs = options?.autoStopMs ?? 2600;
    autoStopTimer = setTimeout(() => {
      void stopRingtonePreview().then(() => onEnd?.());
    }, autoStopMs);
  } catch (e) {
    if (__DEV__) console.warn('[ringtonePreviewAudio]', e);
  }
}

export async function setRingtonePreviewVolume(volumePercent: number): Promise<void> {
  const vol = Math.max(0, Math.min(1, volumePercent / 100));
  if (!previewSound) return;
  try {
    const status = await previewSound.getStatusAsync();
    if (status.isLoaded) {
      await previewSound.setVolumeAsync(vol);
    }
  } catch {
    /* noop */
  }
}

export function isRingtonePreviewActive(): boolean {
  return previewSound != null;
}
