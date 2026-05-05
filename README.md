# Idle Ball Escape Â· 3D

A bouncing-ball idle game with concentric neon polygon rings, a Beat-Saber-style
tunnel, and a 4/4 drum kit synthesized live from your bouncing balls. Each
multi-ball upgrade adds a new drum to your kit.

## Play

Open `index.html` in any modern browser. Three.js loads from CDN â there's no
build step, no install, no dependencies on disk.

## Controls

- **Tap / click the play field** â boost (1.5Ã speed, 2.5Ã damage for 600ms)
- **Upgrade buttons (bottom)** â spend cash on damage, income, velocity,
  multi-ball, crit, dampener, pierce
- **Mute (top-right)** â toggle audio
- **Menu** â stats + reset

## Goal

The innermost ring shrinks over time. Destroy each layer before its inner wall
crushes the ball. Break through all 5 rings to advance the stage. Stages get
harder; ring HP and squeeze rate both scale up.

## Drum kit

Each ball you own is a drum voice that fires on a 128 BPM 4/4 grid:

1. KICK â sub sine with click transient
2. SNARE â pitched body + bandpass noise rattle
3. HI-HAT â 80ms highpass noise burst
4. OPEN HAT â same kit-piece with long sizzle
5. COWBELL â classic 808 two-square-wave bandpass
6. BASS â sub-sine with octave triangle

The drums only play if a ball with that index exists, so buying multi-ball
upgrades fills out the beat. Bounces still trigger a quiet bounce-tick for
audio feedback without fighting the kit.

## Install as a mobile/desktop app (PWA)

1. Serve the folder over HTTPS (any static host works â GitHub Pages, Netlify,
   Vercel, or `python -m http.server` for local testing)
2. Visit the URL in Chrome / Edge / Safari
3. Use the browser's "Install app" / "Add to Home Screen" option

The included `manifest.webmanifest` registers the game as a fullscreen,
portrait-locked installable app with the cyan-to-magenta polygon icon.

## Tech

- Three.js r128 (CDN)
- Web Audio API â every sound is synthesized live
- Persistent save: `localStorage` standalone, `window.storage` inside Claude.ai
- Pure HTML/CSS/JS, single-file ~95 KB

## Files

```
index.html              Main game (everything inline)
sw.js                   Service worker — cache-first offline PWA
manifest.webmanifest    PWA manifest
icon.svg                App icon (concentric polygons)
samples-opus/           Bundled MOONBOY pack at Opus 96k/128k (~6.6MB, deployed)
samples/                Raw WAV originals (~136MB, gitignored — re-derive via script)
scripts/build-opus.mjs  ffmpeg transcode runner (samples/ -> samples-opus/)
README.md               This file
```

## Deploy to GitHub Pages

```bash
gh auth login                                    # one-time, opens browser
gh repo create idle-ball-escape --public --source=. --push
gh api -X POST repos/:owner/:repo/pages \
  -f source[branch]=main -f source[path]=/
```

After ~60s your game is live at `https://<username>.github.io/idle-ball-escape/`.
Open that URL in iOS Safari, tap Share -> Add to Home Screen, you have a fullscreen
PWA. The service worker caches everything on first visit so it plays offline after.

## Re-deriving the Opus pack

If you change samples or want a different bitrate, install ffmpeg, then:

```bash
node scripts/build-opus.mjs
```

The script walks `samples/`, transcodes each .wav to `.opus` at 96k (drums) or
128k (loops), and rewrites `samples-opus/manifest.json` with the new filenames.

Built by Drewski.
