// Transcodes everything in samples/ to samples-opus/ as Opus.
// - Drum one-shots: 96k VBR (transparent for short transients)
// - Loops (guitar + drum): 128k VBR stereo
// Produces samples-opus/manifest.json with .opus filenames.
// Requires ffmpeg in PATH or specified via FFMPEG env var.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, basename } from 'node:path';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const SRC = 'samples';
const DST = 'samples-opus';

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(wav|mp3|flac|aiff?|m4a)$/i.test(name)) yield full;
  }
}

function transcode(src, dst, bitrate) {
  mkdirSync(dirname(dst), { recursive: true });
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-i', src,
    '-c:a', 'libopus',
    '-b:a', bitrate,
    '-vbr', 'on',
    '-application', 'audio',
    dst,
  ], { stdio: ['ignore', 'inherit', 'inherit'] });
}

function pickBitrate(srcRel) {
  // loops/ and guitar/ get higher bitrate; drums get tight 96k
  if (srcRel.startsWith('guitar') || srcRel.startsWith('loops')) return '128k';
  return '96k';
}

const start = Date.now();
mkdirSync(DST, { recursive: true });

const tasks = [];
for (const wav of walk(SRC)) {
  const rel = relative(SRC, wav).replaceAll('\\', '/');
  const opusRel = rel.replace(/\.[^.]+$/, '.opus');
  const dst = join(DST, opusRel);
  if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(wav).mtimeMs) {
    process.stdout.write(`= ${rel}\n`);
    continue;
  }
  process.stdout.write(`> ${rel} (${pickBitrate(rel)})\n`);
  transcode(wav, dst, pickBitrate(rel));
}

// Rebuild the manifest (same shape as the WAV manifest) but with .opus filenames.
function listOpus(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => n.endsWith('.opus')).sort();
}

const drumsDir  = join(DST, 'drums');
const guitarDir = join(DST, 'guitar');
const loopsDir  = join(DST, 'loops');

const drumFiles = listOpus(drumsDir);
const pick = (re) => drumFiles.filter(n => re.test(n));
const drumBuckets = {
  kicks:      pick(/Kick/),
  snares:     pick(/Snare/),
  closedHats: pick(/Closed Hat/),
  openHats:   pick(/Open Hat/),
  toms:       pick(/Tom/).filter(n => !/Lo/.test(n)),
  tomsLo:     pick(/Tom \(Lo/),
  crashes:    pick(/Crash/),
};

function parseBpm(s) { const m = s.match(/(\d{2,3})BPM/); return m ? parseInt(m[1], 10) : 0; }
function parseKey(s) { const m = s.match(/(\d{2,3})BPM\s+([A-G]#?(?:min|maj))/); return m ? m[2] : null; }
function parseIdx(s, label) { const re = new RegExp(`${label}\\s*(\\d+)`); const m = s.match(re); return m ? parseInt(m[1], 10) : 0; }

const guitarLoops = listOpus(guitarDir).map(file => ({
  file,
  bpm: parseBpm(file),
  key: parseKey(file),
  idx: parseIdx(file, 'Electric'),
})).sort((a,b) => a.idx - b.idx);

const drumLoops = listOpus(loopsDir).map(file => ({
  file,
  bpm: parseBpm(file),
  idx: parseIdx(file, 'Drum Loop'),
})).sort((a,b) => a.idx - b.idx);

const manifest = { drums: drumBuckets, guitarLoops, drumLoops };
writeFileSync(join(DST, 'manifest.json'), JSON.stringify(manifest, null, 2));

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\nDone in ${elapsed}s`);
console.log(`  ${drumBuckets.kicks.length} kicks, ${drumBuckets.snares.length} snares, ${drumBuckets.closedHats.length} closed hats, ${drumBuckets.openHats.length} open hat, ${drumBuckets.toms.length}+${drumBuckets.tomsLo.length} toms, ${drumBuckets.crashes.length} crashes`);
console.log(`  ${guitarLoops.length} guitar loops, ${drumLoops.length} drum loops`);
