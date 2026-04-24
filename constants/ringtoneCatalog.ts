/**
 * Fonte única de tons: todos os ficheiros em `assets/sounds/ringtones/`.
 * Notificações de corrida e chamadas de internet partilham o mesmo mapa (`RINGTONE_SOUND_MODULES`).
 */

export const RINGTONE_IDS = [
  'modern_default',
  'horizon',
  'pulse_tone',
  'reflection',
  'aurora',
  'piano_simple',
  'piano_soft',
  'harmony_light',
  'strings_light',
  'ring_classic',
  'ring_modern',
  'dual_tone_modern',
  'atmospheric',
  'digital_soft',
  'wave',
  'flow',
  'urgent_elegant',
  'premium_tone',
  'rising_alert',
] as const;

export type RingtoneId = (typeof RINGTONE_IDS)[number];

export type RingtoneCategory =
  | 'smartphone_modern'
  | 'musical_light'
  | 'classic_refined'
  | 'ambient_modern'
  | 'highlight';

export const RINGTONE_CATEGORY_ORDER: RingtoneCategory[] = [
  'smartphone_modern',
  'musical_light',
  'classic_refined',
  'ambient_modern',
  'highlight',
];

export const RINGTONE_CATEGORY_LABELS_PT: Record<RingtoneCategory, string> = {
  smartphone_modern: 'Estilo smartphone moderno',
  musical_light: 'Estilo musical leve',
  classic_refined: 'Estilo clássico melhorado',
  ambient_modern: 'Estilo ambiente moderno',
  highlight: 'Estilo destaque',
};

export type RingtoneUIOption = {
  id: RingtoneId;
  category: RingtoneCategory;
  labelPt: string;
  descriptionPt: string;
};

/** Lista partilhada pelos ecrãs de escolha (corrida e chamadas de internet). */
export const RINGTONE_UI_OPTIONS: RingtoneUIOption[] = [
  {
    id: 'modern_default',
    category: 'smartphone_modern',
    labelPt: 'Moderno padrão',
    descriptionPt: 'Limpo e equilibrado',
  },
  {
    id: 'horizon',
    category: 'smartphone_modern',
    labelPt: 'Horizon',
    descriptionPt: 'Melodia crescente suave',
  },
  {
    id: 'pulse_tone',
    category: 'smartphone_modern',
    labelPt: 'Pulse tone',
    descriptionPt: 'Batida elegante contínua',
  },
  {
    id: 'reflection',
    category: 'smartphone_modern',
    labelPt: 'Reflection',
    descriptionPt: 'Toque leve e espaçado',
  },
  {
    id: 'aurora',
    category: 'smartphone_modern',
    labelPt: 'Aurora',
    descriptionPt: 'Ambiente suave com progressão',
  },
  {
    id: 'piano_simple',
    category: 'musical_light',
    labelPt: 'Piano simples',
    descriptionPt: 'Melodia curta e emocional',
  },
  {
    id: 'piano_soft',
    category: 'musical_light',
    labelPt: 'Piano suave',
    descriptionPt: 'Mais fluido e contínuo',
  },
  {
    id: 'harmony_light',
    category: 'musical_light',
    labelPt: 'Harmonia leve',
    descriptionPt: 'Camadas suaves',
  },
  {
    id: 'strings_light',
    category: 'musical_light',
    labelPt: 'Cordas leves',
    descriptionPt: 'Orquestral discreto',
  },
  {
    id: 'ring_classic',
    category: 'classic_refined',
    labelPt: 'Ring clássico',
    descriptionPt: 'Telefone tradicional refinado',
  },
  {
    id: 'ring_modern',
    category: 'classic_refined',
    labelPt: 'Ring moderno',
    descriptionPt: 'Versão atualizada do clássico',
  },
  {
    id: 'dual_tone_modern',
    category: 'classic_refined',
    labelPt: 'Dual tone moderno',
    descriptionPt: 'Dois tons harmónicos',
  },
  {
    id: 'atmospheric',
    category: 'ambient_modern',
    labelPt: 'Atmosférico',
    descriptionPt: 'Som espacial suave',
  },
  {
    id: 'digital_soft',
    category: 'ambient_modern',
    labelPt: 'Digital suave',
    descriptionPt: 'Sintetizado limpo',
  },
  {
    id: 'wave',
    category: 'ambient_modern',
    labelPt: 'Wave',
    descriptionPt: 'Onda sonora contínua',
  },
  {
    id: 'flow',
    category: 'ambient_modern',
    labelPt: 'Flow',
    descriptionPt: 'Transição fluida entre notas',
  },
  {
    id: 'urgent_elegant',
    category: 'highlight',
    labelPt: 'Urgente elegante',
    descriptionPt: 'Sem ser agressivo',
  },
  {
    id: 'premium_tone',
    category: 'highlight',
    labelPt: 'Premium tone',
    descriptionPt: 'Rico e encorpado',
  },
  {
    id: 'rising_alert',
    category: 'highlight',
    labelPt: 'Rising alert',
    descriptionPt: 'Crescimento progressivo',
  },
];

export const RINGTONE_SOUND_MODULES: Record<RingtoneId, number> = {
  modern_default: require('@/assets/sounds/ringtones/modern_default.mp3'),
  horizon: require('@/assets/sounds/ringtones/horizon.mp3'),
  pulse_tone: require('@/assets/sounds/ringtones/pulse_tone.mp3'),
  reflection: require('@/assets/sounds/ringtones/reflection.mp3'),
  aurora: require('@/assets/sounds/ringtones/aurora.mp3'),
  piano_simple: require('@/assets/sounds/ringtones/piano_simple.mp3'),
  piano_soft: require('@/assets/sounds/ringtones/piano_soft.mp3'),
  harmony_light: require('@/assets/sounds/ringtones/harmony_light.mp3'),
  strings_light: require('@/assets/sounds/ringtones/strings_light.mp3'),
  ring_classic: require('@/assets/sounds/ringtones/ring_classic.mp3'),
  ring_modern: require('@/assets/sounds/ringtones/ring_modern.mp3'),
  dual_tone_modern: require('@/assets/sounds/ringtones/dual_tone_modern.mp3'),
  atmospheric: require('@/assets/sounds/ringtones/atmospheric.mp3'),
  digital_soft: require('@/assets/sounds/ringtones/digital_soft.mp3'),
  wave: require('@/assets/sounds/ringtones/wave.mp3'),
  flow: require('@/assets/sounds/ringtones/flow.mp3'),
  urgent_elegant: require('@/assets/sounds/ringtones/urgent_elegant.mp3'),
  premium_tone: require('@/assets/sounds/ringtones/premium_tone.mp3'),
  rising_alert: require('@/assets/sounds/ringtones/rising_alert.mp3'),
};

export function labelForRingtone(id: RingtoneId): string {
  return RINGTONE_UI_OPTIONS.find((o) => o.id === id)?.labelPt ?? id;
}

export function isRingtoneId(value: string): value is RingtoneId {
  return (RINGTONE_IDS as readonly string[]).includes(value);
}

/** Antigos 8 tons de corrida (AsyncStorage legado). */
export type LegacyRideSoundId =
  | 'system'
  | 'classico'
  | 'digital'
  | 'suave'
  | 'alerta_rapido'
  | 'premium'
  | 'pulsante'
  | 'minimalista';

export const LEGACY_RIDE_SOUND_TO_RINGTONE: Record<LegacyRideSoundId, RingtoneId> = {
  system: 'modern_default',
  classico: 'ring_classic',
  digital: 'digital_soft',
  suave: 'reflection',
  alerta_rapido: 'rising_alert',
  premium: 'premium_tone',
  pulsante: 'pulse_tone',
  minimalista: 'flow',
};

export function migrateLegacyRideSoundToRingtone(value: string): RingtoneId | null {
  if (isRingtoneId(value)) return value;
  const m = LEGACY_RIDE_SOUND_TO_RINGTONE as Record<string, RingtoneId>;
  return m[value] ?? null;
}
