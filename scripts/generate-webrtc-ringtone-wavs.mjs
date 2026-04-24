/**
 * Gera melodias tipo toque de smartphone (8–12s, loop suave, ~44,1 kHz).
 * Saída: assets/sounds/ringtones/ (catálogo único; converter para .mp3 se necessário para o bundle).
 * Executar: node scripts/generate-webrtc-ringtone-wavs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets', 'sounds', 'ringtones');
fs.mkdirSync(outDir, { recursive: true });

const SR = 44100;
const DURATION_SEC = 10; // 10s — ciclo perfeito com parciais inteiras
const N = Math.floor(SR * DURATION_SEC);

function writeWav16(filepath, floatBuf) {
  const dataSize = floatBuf.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  let o = 44;
  for (let i = 0; i < floatBuf.length; i += 1) {
    const v = Math.max(-1, Math.min(1, floatBuf[i]));
    buf.writeInt16LE(Math.round(v * 32767), o);
    o += 2;
  }
  fs.writeFileSync(filepath, buf);
}

function normalize(buf) {
  let peak = 1e-6;
  for (let i = 0; i < buf.length; i += 1) peak = Math.max(peak, Math.abs(buf[i]));
  const g = 0.94 / peak;
  for (let i = 0; i < buf.length; i += 1) buf[i] *= g;
}

/** Parciais com nº inteiro de ciclos em DURATION_SEC segundos. */
function toneSum(sampleFns) {
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i += 1) {
    const t = i / SR;
    let s = 0;
    for (const fn of sampleFns) s += fn(t, i);
    buf[i] = s;
  }
  normalize(buf);
  return buf;
}

const tau = DURATION_SEC;
const smoothEnds = (t) => 0.82 + 0.18 * Math.cos((2 * Math.PI * t) / tau); /* ~igual em 0 e T */

// —— Presets (evitar bips curtos: melodias >8s com evolução lenta) ——

const presets = {
  modern_default: () =>
    toneSum([
      (t) => 0.35 * Math.sin(2 * Math.PI * 523 * t + 0.25 * Math.sin(2 * Math.PI * 5.2 * t)),
      (t) => 0.22 * Math.sin(2 * Math.PI * 659 * t + 0.2 * Math.sin(2 * Math.PI * 4.8 * t)),
      (t) => 0.12 * Math.sin(2 * Math.PI * 784 * t) * smoothEnds(t),
    ]),

  horizon: () =>
    toneSum([
      (t) => {
        const sweep = 0.31 * Math.sin(2 * Math.PI * (320 + 28 * Math.sin((2 * Math.PI * t) / 24)) * t);
        return sweep * smoothEnds(t);
      },
      (t) => 0.18 * Math.sin(2 * Math.PI * 440 * t) * (0.55 + 0.45 * Math.sin((2 * Math.PI * t) / 28)),
    ]),

  pulse_tone: () =>
    toneSum([
      (t) =>
        0.34 *
        Math.sin(2 * Math.PI * 587 * t) *
        (0.45 + 0.55 * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 2.2)) ** 2),
      (t) => 0.15 * Math.sin(2 * Math.PI * 880 * t + 0.3 * Math.sin(2 * Math.PI * 6 * t)),
    ]),

  reflection: () =>
    toneSum([
      (t) => 0.28 * Math.sin(2 * Math.PI * 392 * t) * (0.65 + 0.35 * Math.sin((2 * Math.PI * t) / 5.5)),
      (t) => 0.22 * Math.sin(2 * Math.PI * 523 * t + 0.18 * Math.sin(2 * Math.PI * 2.8 * t)),
      (t) => 0.1 * Math.sin(2 * Math.PI * 698 * t) * smoothEnds(t),
    ]),

  aurora: () =>
    toneSum([
      (t) => 0.25 * Math.sin(2 * Math.PI * 330 * t) * (0.7 + 0.3 * Math.sin((2 * Math.PI * t) / 18)),
      (t) => 0.22 * Math.sin(2 * Math.PI * 415 * t + 0.4 * Math.sin((2 * Math.PI * t) / 21)),
      (t) => 0.18 * Math.sin(2 * Math.PI * 523 * t) * Math.sin((2 * Math.PI * t) / 12 + 1),
    ]),

  piano_simple: () =>
    toneSum([
      (t) => 0.42 * Math.sin(2 * Math.PI * 262 * t) * Math.exp(-0.08 * (t % 2.5)) * (0.55 + 0.45 * Math.sin((2 * Math.PI * t) / 9)),
      (t) => 0.24 * Math.sin(2 * Math.PI * 330 * t) * Math.sin((2 * Math.PI * t) / 7 + 0.4),
      (t) => 0.12 * Math.sin(2 * Math.PI * 392 * t) * smoothEnds(t),
    ]),

  piano_soft: () =>
    toneSum([
      (t) => 0.38 * Math.sin(2 * Math.PI * 294 * t) * (0.88 + 0.12 * Math.sin((2 * Math.PI * t) / 14)),
      (t) => 0.28 * Math.sin(2 * Math.PI * 370 * t + 0.12 * Math.sin(2 * Math.PI * 3 * t)),
      (t) => 0.15 * Math.sin(2 * Math.PI * 494 * t) * smoothEnds(t),
    ]),

  harmony_light: () =>
    toneSum([
      (t) => 0.26 * Math.sin(2 * Math.PI * 440 * t),
      (t) => 0.22 * Math.sin(2 * Math.PI * 554 * t),
      (t) => 0.2 * Math.sin(2 * Math.PI * 659 * t),
      (t) => 0.14 * Math.sin(2 * Math.PI * 880 * t) * smoothEnds(t),
    ]),

  strings_light: () =>
    toneSum([
      (t) =>
        0.22 *
        Math.sin(2 * Math.PI * 294 * t + 0.08 * Math.sin(2 * Math.PI * 5 * t)) *
        (0.55 + 0.45 * Math.sin((2 * Math.PI * t) / 11)),
      (t) => 0.2 * Math.sin(2 * Math.PI * 392 * t),
      (t) => 0.18 * Math.sin(2 * Math.PI * 523 * t),
      (t) => 0.12 * Math.sin(2 * Math.PI * 659 * t) * smoothEnds(t),
    ]),

  ring_classic: () =>
    toneSum([
      (t) =>
        0.4 *
        Math.sin(2 * Math.PI * 440 * t) *
        (0.45 + 0.55 * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 1.8)) ** 1.5),
      (t) => 0.22 * Math.sin(2 * Math.PI * 480 * t) * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 2.4)),
    ]),

  ring_modern: () =>
    toneSum([
      (t) => 0.33 * Math.sin(2 * Math.PI * 523 * t) * (0.4 + 0.6 * Math.abs(Math.sin((2 * Math.PI * t) / 2))),
      (t) => 0.26 * Math.sin(2 * Math.PI * 659 * t) * (0.55 + 0.45 * Math.sin((2 * Math.PI * t) / 8)),
      (t) => 0.14 * Math.sin(2 * Math.PI * 784 * t) * smoothEnds(t),
    ]),

  dual_tone_modern: () =>
    toneSum([
      (t) => 0.32 * Math.sin(2 * Math.PI * 400 * t) * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 3)),
      (t) => 0.32 * Math.sin(2 * Math.PI * 504 * t + 0.4) * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 3 + 1.2)),
      (t) => 0.14 * Math.sin(2 * Math.PI * 800 * t) * smoothEnds(t),
    ]),

  atmospheric: () =>
    toneSum([
      (t) => 0.3 * Math.sin(2 * Math.PI * 220 * t + 0.5 * Math.sin(2 * Math.PI * 0.35 * t)),
      (t) => 0.24 * Math.sin(2 * Math.PI * 277 * t + 0.35 * Math.sin(2 * Math.PI * 0.42 * t)),
      (t) => 0.18 * Math.sin(2 * Math.PI * 349 * t) * smoothEnds(t),
    ]),

  digital_soft: () =>
    toneSum([
      (t) => 0.34 * Math.sin(2 * Math.PI * 587 * t + 0.15 * Math.sin(2 * Math.PI * 8 * t)),
      (t) => 0.22 * Math.sin(2 * Math.PI * 739 * t + 0.12 * Math.sin(2 * Math.PI * 9 * t)),
      (t) => 0.12 * Math.sin(2 * Math.PI * 1175 * t) * smoothEnds(t),
    ]),

  wave: () =>
    toneSum([
      (t) => {
        const f = 350 + 40 * Math.sin((2 * Math.PI * t) / 16);
        return 0.36 * Math.sin(2 * Math.PI * f * t);
      },
      (t) => 0.2 * Math.sin(2 * Math.PI * 520 * t) * Math.sin((2 * Math.PI * t) / 20),
    ]),

  flow: () =>
    toneSum([
      (t) => 0.28 * Math.sin(2 * Math.PI * 415 * t + 0.25 * Math.sin((2 * Math.PI * t) / 13)),
      (t) => 0.26 * Math.sin(2 * Math.PI * 523 * t + 0.2 * Math.sin((2 * Math.PI * t) / 15)),
      (t) => 0.2 * Math.sin(2 * Math.PI * 622 * t) * smoothEnds(t),
    ]),

  urgent_elegant: () =>
    toneSum([
      (t) =>
        0.3 *
        Math.sin(2 * Math.PI * 660 * t) *
        (0.38 + 0.62 * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 2.6)) ** 1.2),
      (t) => 0.24 * Math.sin(2 * Math.PI * 880 * t) * (0.55 + 0.45 * Math.sin((2 * Math.PI * t) / 6)),
      (t) => 0.12 * Math.sin(2 * Math.PI * 1100 * t) * smoothEnds(t),
    ]),

  premium_tone: () =>
    toneSum([
      (t) => 0.24 * Math.sin(2 * Math.PI * 349 * t),
      (t) => 0.22 * Math.sin(2 * Math.PI * 440 * t),
      (t) => 0.2 * Math.sin(2 * Math.PI * 554 * t),
      (t) => 0.18 * Math.sin(2 * Math.PI * 659 * t),
      (t) => 0.12 * Math.sin(2 * Math.PI * 880 * t) * smoothEnds(t),
    ]),

  rising_alert: () =>
    toneSum([
      (t) => {
        const rise = t / tau;
        return 0.38 * Math.sin(2 * Math.PI * (360 + 220 * rise) * t) * (0.45 + 0.55 * rise);
      },
      (t) => 0.16 * Math.sin(2 * Math.PI * 784 * t) * smoothEnds(t),
    ]),
};

for (const [name, gen] of Object.entries(presets)) {
  const buf = gen();
  if (buf.length !== N) {
    console.error('Length mismatch', name);
    process.exit(1);
  }
  writeWav16(path.join(outDir, `${name}.wav`), buf);
  console.log('written', `${name}.wav`, N, 'samples');
}
