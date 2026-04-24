import type { RideSoundId } from '@/constants/rideSounds';
import {
  isRingtonePreviewActive,
  playRingtonePreview,
  setRingtonePreviewVolume,
  stopRingtonePreview,
} from '@/services/ringtonePreviewAudio';

export type RideAlertPreviewOptions = {
  isLooping?: boolean;
  autoStopMs?: number;
  /** Uma vez até ao fim do ficheiro (lista de tons). */
  playUntilEnd?: boolean;
};

const DEFAULT_AUTO_STOP_MS = 2600;

/**
 * Para pré-visualização única (partilhada com chamadas de internet).
 * @deprecated preferir `stopRingtonePreview` de `@/services/ringtonePreviewAudio`
 */
export async function stopPreview(): Promise<void> {
  await stopRingtonePreview();
}

export async function playPreview(
  soundId: RideSoundId,
  volumePercent: number,
  options?: RideAlertPreviewOptions,
): Promise<void> {
  if (options?.playUntilEnd) {
    await playRingtonePreview(soundId, volumePercent, {
      playUntilEnd: true,
    });
    return;
  }
  await playRingtonePreview(soundId, volumePercent, {
    isLooping: options?.isLooping ?? true,
    autoStopMs: options?.autoStopMs ?? DEFAULT_AUTO_STOP_MS,
  });
}

export async function setPreviewVolume(volumePercent: number): Promise<void> {
  await setRingtonePreviewVolume(volumePercent);
}

export function isPreviewActive(): boolean {
  return isRingtonePreviewActive();
}
