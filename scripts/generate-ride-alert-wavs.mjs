/**
 * Gera tons WAV simples (8 categorias) para alertas de corrida — executar na raiz do projeto:
 * node scripts/generate-ride-alert-wavs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets', 'sounds', 'rides');
fs.mkdirSync(outDir, { recursive: true });

function writeWav(filepath, samples, sampleRate = 16000, bitsPerSample = 16) {
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
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
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
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

function sineSpan(sr, t0, t1, freq, amp) {
  const n = Math.floor((t1 - t0) * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = t0 + i / sr;
    const env = Math.min(1, i / (sr * 0.02)) * Math.min(1, (n - i) / (sr * 0.02));
    out[i] = Math.sin(2 * Math.PI * freq * t) * amp * env;
  }
  return out;
}

function mix(base, offset, segment) {
  for (let i = 0; i < segment.length; i += 1) {
    if (offset + i < base.length) base[offset + i] += segment[i];
  }
}

function buildBuffer(totalSec, sr, fn) {
  const n = Math.floor(totalSec * sr);
  const buf = new Float32Array(n);
  fn(sr, buf);
  let peak = 0.001;
  for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(buf[i]));
  const norm = 0.92 / peak;
  for (let i = 0; i < n; i += 1) buf[i] *= norm;
  return buf;
}

const SR = 16000;

const presets = {
  system: (sr, buf) => {
    const s = sineSpan(sr, 0, 0.18, 1046.5, 0.35);
    mix(buf, 0, s);
  },
  classico: (sr, buf) => {
    mix(buf, 0, sineSpan(sr, 0, 0.12, 659, 0.4));
    mix(buf, Math.floor(0.2 * sr), sineSpan(sr, 0.2, 0.32, 784, 0.4));
  },
  digital: (sr, buf) => {
    const freqs = [523, 659, 784, 1046];
    freqs.forEach((f, k) => {
      mix(buf, Math.floor(k * 0.06 * sr), sineSpan(sr, k * 0.06, k * 0.06 + 0.08, f, 0.25));
    });
  },
  suave: (sr, buf) => {
    mix(buf, 0, sineSpan(sr, 0, 0.45, 330, 0.22));
  },
  alerta_rapido: (sr, buf) => {
    mix(buf, 0, sineSpan(sr, 0, 0.06, 1200, 0.45));
  },
  premium: (sr, buf) => {
    mix(buf, 0, sineSpan(sr, 0, 0.2, 440, 0.2));
    mix(buf, 0, sineSpan(sr, 0, 0.2, 554, 0.2));
    mix(buf, 0, sineSpan(sr, 0, 0.2, 659, 0.2));
  },
  pulsante: (sr, buf) => {
    for (let p = 0; p < 4; p += 1) {
      mix(buf, Math.floor(p * 0.15 * sr), sineSpan(sr, 0, 0.1, 880, 0.3));
    }
  },
  minimalista: (sr, buf) => {
    mix(buf, 0, sineSpan(sr, 0, 0.05, 2000, 0.18));
  },
};

for (const [name, fn] of Object.entries(presets)) {
  const buf = buildBuffer(1.2, SR, fn);
  writeWav(path.join(outDir, `${name}.wav`), Array.from(buf), SR);
  console.log('written', name + '.wav');
}
