/**
 * @deprecated — Use antes para toques de chamada; substituído por:
 *   node scripts/generate-webrtc-ringtone-wavs.mjs
 * (melodias ~10s, 44,1 kHz). Este ficheiro mantém-se só como referência.
 *
 * Gera 7 tons (loop WAV curto, ~1.6s) para toque de chamada (legado).
 * node scripts/generate-webrtc-call-wavs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets', 'sounds', 'webrtc');
fs.mkdirSync(outDir, { recursive: true });

function writeWav(filepath, samples, sampleRate = 16000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  let o = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
    buf.writeInt16LE(v, o);
    o += 2;
  }
  fs.writeFileSync(filepath, buf);
}

function sine(sr, t0, lenSec, freq, amp) {
  const n = Math.floor(lenSec * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = t0 + i / sr;
    const env = Math.min(1, i / (sr * 0.04)) * Math.min(1, (n - i) / (sr * 0.08));
    out[i] = Math.sin(2 * Math.PI * freq * t) * amp * env;
  }
  return out;
}

function mixAt(buf, offset, segment) {
  for (let i = 0; i < segment.length; i += 1) {
    const j = offset + i;
    if (j < buf.length) buf[j] += segment[i];
  }
}

function normalize(buf) {
  let peak = 0.001;
  for (let i = 0; i < buf.length; i += 1) peak = Math.max(peak, Math.abs(buf[i]));
  const g = 0.92 / peak;
  for (let i = 0; i < buf.length; i += 1) buf[i] *= g;
}

const SR = 16000;
const T = 1.65;
const N = Math.floor(T * SR);

const presets = {
  system: (buf) => {
    mixAt(buf, 0, sine(SR, 0, 0.25, 1000, 0.35));
  },
  classico: (buf) => {
    mixAt(buf, 0, sine(SR, 0, 0.35, 440, 0.32));
    mixAt(buf, Math.floor(0.42 * SR), sine(SR, 0, 0.35, 523, 0.32));
  },
  digital_loop: (buf) => {
    for (let k = 0; k < 5; k += 1) {
      mixAt(buf, Math.floor(k * 0.28 * SR), sine(SR, 0, 0.15, 660 + k * 80, 0.22));
    }
  },
  pulsante: (buf) => {
    for (let p = 0; p < 6; p += 1) {
      mixAt(buf, Math.floor(p * 0.22 * SR), sine(SR, 0, 0.12, 900, 0.28));
    }
  },
  urgente: (buf) => {
    mixAt(buf, 0, sine(SR, 0, 0.18, 1400, 0.42));
    mixAt(buf, Math.floor(0.25 * SR), sine(SR, 0, 0.22, 1600, 0.4));
    mixAt(buf, Math.floor(0.55 * SR), sine(SR, 0, 0.28, 1200, 0.38));
  },
  suave_loop: (buf) => {
    mixAt(buf, 0, sine(SR, 0, T, 350, 0.18));
  },
  premium_loop: (buf) => {
    mixAt(buf, 0, sine(SR, 0, T, 392, 0.15));
    mixAt(buf, 0, sine(SR, 0, T, 494, 0.15));
    mixAt(buf, 0, sine(SR, 0, T, 587, 0.12));
  },
};

for (const [name, fn] of Object.entries(presets)) {
  const buf = new Float32Array(N);
  fn(buf);
  normalize(buf);
  writeWav(path.join(outDir, `${name}.wav`), Array.from(buf), SR);
  console.log('written', name + '.wav');
}
