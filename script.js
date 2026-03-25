const bg = document.getElementById("bg");
const bctx = bg.getContext("2d");
const noise = document.getElementById("noise");
const nctx = noise.getContext("2d");
const landingText = document.getElementById("landingText");
const chamberMeta = document.getElementById("chamberMeta");
const metaLine1 = document.getElementById("metaLine1");
const metaLine2 = document.getElementById("metaLine2");
const video = document.getElementById("video");
const splashAudio = document.getElementById("splashAudio");
const chamberAudio = document.getElementById("chamberAudio");

const CHAMBERS = [
  {
    title1: "Traffic Court",
    title2: ".. 33310",
    audio: "audio-1.mp3",
    video: "video-1.mp4",
    visual: 1.00
  },
  {
    title1: "Somewhere Else",
    title2: ".. Side B",
    audio: "audio-2.mp3",
    video: "video-2.mp4",
    visual: 1.18
  },
  {
    title1: "Frogman",
    title2: ".. Blockchain",
    audio: "audio-3.mp3",
    video: "video-3.mp4",
    visual: 1.36
  }
]

const ENTRY_DURATION_MS = 9000;
const HOLD_THRESHOLD_MS = 420;

let w = 0, h = 0;
let noiseData;

let appState = "landing"; // landing, woken, entering, chamber
let activeChamber = 0;
let entryProgress = 0;

function chamberVisualFactor() {
  return CHAMBERS[activeChamber]?.visual ?? 1;
}

let splashStarted = false;
let chamberStarted = false;
let audioUnlocked = false;

let pointerDown = false;
let activePointerId = null;
let holdTimer = null;
let holdActive = false;
let ignoreNextClickUntil = 0;

let touchPulse = 0;
let wakeMix = 0;
let holdMix = 0;
let holdBreak = 0;
let holdGlitch = 0;
let driftImpulse = 0;
let lastImpulse = 0;
let ambientDisturbUntil = 0;
let nextAmbientDisturbAt = 0;
let lastFrame = performance.now();

const splashTargetVolume = 0.42;
const chamberTargetVolume = 0.58;

function resize() {
  w = innerWidth;
  h = innerHeight;
  bg.width = w;
  bg.height = h;
  noise.width = w;
  noise.height = h;
  noiseData = nctx.createImageData(w, h);
}
addEventListener("resize", resize);

function setChamber(index) {
  const c = CHAMBERS[index];
  activeChamber = index;
  metaLine1.textContent = c.title1;
  metaLine2.textContent = c.title2;
  chamberAudio.src = c.audio;
  video.src = c.video;
  chamberStarted = false;
}

async function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  splashAudio.muted = false;
  chamberAudio.muted = false;
  splashAudio.volume = 0;
  chamberAudio.volume = 0;
}

async function startSplashIfNeeded() {
  await unlockAudio();
  if (splashStarted) return;
  splashStarted = true;
  splashAudio.src = "splash.mp3";
  splashAudio.loop = false;
  splashAudio.volume = 0;
  try {
    splashAudio.currentTime = 0;
    await splashAudio.play();
  } catch (e) {
    console.error("splash play failed", e);
  }
}

async function startChamberIfNeeded() {
  await unlockAudio();
  if (chamberStarted) return;
  chamberStarted = true;
  chamberAudio.loop = true;
  chamberAudio.volume = 0;
  try {
    if (chamberAudio.readyState >= 1 && chamberAudio.duration && isFinite(chamberAudio.duration) && chamberAudio.duration > 0) {
      chamberAudio.currentTime = Math.random() * chamberAudio.duration;
    }
  } catch (e) {}
  try {
    await chamberAudio.play();
  } catch (e) {
    console.error("chamber play failed", e);
    chamberStarted = false;
  }
}

async function startVideoIfNeeded() {
  if (!video.paused) return;
  try {
    if (video.readyState >= 1 && video.duration && isFinite(video.duration) && video.duration > 0) {
      video.currentTime = Math.random() * video.duration;
    }
  } catch (e) {}
  video.playbackRate = 0.92;
  video.play().catch(() => {});
}

async function wakeSplash() {
  if (appState !== "landing") return;
  appState = "woken";
  wakeMix = 1;
  touchPulse = 1;
  await startSplashIfNeeded();
  splashAudio.volume = splashTargetVolume * 0.85;
}

async function enterChamber() {
  if (appState !== "woken") return;
  appState = "entering";
  entryProgress = 0;
  touchPulse = 1;
  setChamber(activeChamber);
  await startChamberIfNeeded();
  await startVideoIfNeeded();
}

async function nextChamber() {
  if (CHAMBERS.length <= 1) return;
  const next = (activeChamber + 1) % CHAMBERS.length;
  setChamber(next);
  appState = "entering";
  entryProgress = 0.18;
  touchPulse = 1;
  await startChamberIfNeeded();
  await startVideoIfNeeded();
}

function intensifyChamber(on) {
  holdActive = on;
  if (on) {
    touchPulse = 1;
    holdMix = Math.max(holdMix, 0.18);
    holdBreak = 1;
  }
}

function clearHoldTimer() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}

async function handleTapNavigation(e) {
  if (e && e.cancelable) e.preventDefault();
  const now = performance.now();
  if (now < ignoreNextClickUntil) return;

  if (appState === "landing") {
    await wakeSplash();
    return;
  }
  if (appState === "woken") {
    await enterChamber();
    return;
  }
  if (appState === "chamber") {
    await nextChamber();
  }
}

function onPointerDown(e) {
  if (e && e.cancelable) e.preventDefault();
  if (pointerDown) return;
  pointerDown = true;
  activePointerId = e.pointerId ?? "mouse";
  touchPulse = 1;

  if (appState === "chamber") {
    clearHoldTimer();
    holdTimer = setTimeout(() => {
      if (pointerDown && appState === "chamber") {
        ignoreNextClickUntil = performance.now() + 250;
        intensifyChamber(true);
      }
    }, HOLD_THRESHOLD_MS);
  }
}

function onPointerUp(e) {
  if (e && e.cancelable) e.preventDefault();
  const pid = e.pointerId ?? "mouse";
  if (!pointerDown || activePointerId !== pid) return;
  pointerDown = false;
  activePointerId = null;
  clearHoldTimer();

  if (holdActive) {
    intensifyChamber(false);
  }
}

function onPointerCancel(e) {
  if (e && e.cancelable) e.preventDefault();
  pointerDown = false;
  activePointerId = null;
  clearHoldTimer();
  if (holdActive) intensifyChamber(false);
}

document.addEventListener("contextmenu", e => e.preventDefault());
document.body.addEventListener("click", handleTapNavigation, { passive: false });
document.body.addEventListener("pointerdown", onPointerDown, { passive: false });
document.body.addEventListener("pointerup", onPointerUp, { passive: false });
document.body.addEventListener("pointercancel", onPointerCancel, { passive: false });

function drawField(T, wake, chamber, hold) {
  bctx.fillStyle = "rgb(10,10,10)";
  bctx.fillRect(0, 0, w, h);

  const masses = [
    [0.37, 0.49, 0.42, 190],
    [0.61, 0.43, 0.35, 165],
    [0.48, 0.72, 0.31, 148],
    [0.23, 0.31, 0.24, 126]
  ];

  for (let i = 0; i < masses.length; i++) {
    const m = masses[i];
    const x = w * m[0] + Math.sin(T * (0.08 + i * 0.02) + i) * w * (0.046 + wake * 0.014 + chamber * 0.012 + hold * 0.026);
    const y = h * m[1] + Math.cos(T * (0.06 + i * 0.015) + i * 0.8) * h * (0.042 + wake * 0.010 + chamber * 0.010 + hold * 0.022);
    const r = Math.max(w, h) * m[2] * (1 + Math.sin(T * (0.12 + i * 0.02) + i) * (0.09 + wake * 0.07 + chamber * 0.05 + hold * 0.10));

    const core = Math.min(248, m[3] + wake * 28 + chamber * 16 + hold * 26);
    const grad = bctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${core}, ${core - 8}, ${core - 8}, ${0.20 + wake * 0.08 + chamber * 0.04 + hold * 0.09})`);
    grad.addColorStop(0.34, `rgba(${Math.max(55, core-92)}, ${Math.max(55, core-92)}, ${Math.max(55, core-92)}, ${0.15 + wake * 0.03 + hold * 0.07})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = grad;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  const gx = w * (0.5 + Math.sin(T * 0.05) * 0.028);
  const gy = h * (0.54 + Math.cos(T * 0.045) * 0.025);
  const gr = Math.max(w, h) * (0.44 + wake * 0.025 + chamber * 0.01 + hold * 0.022);
  const redGlow = bctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  redGlow.addColorStop(0, `rgba(118, 18, 18, ${0.10 + wake * 0.06 + hold * 0.07})`);
  redGlow.addColorStop(0.46, `rgba(54, 8, 8, ${0.05 + wake * 0.02 + hold * 0.04})`);
  redGlow.addColorStop(1, "rgba(0,0,0,0)");
  bctx.fillStyle = redGlow;
  bctx.fillRect(0, 0, w, h);
}

function drawNoise(intensity) {
  const len = noiseData.data.length;
  for (let i = 0; i < len; i += 4) {
    const v = Math.random() * 255;
    noiseData.data[i] = v;
    noiseData.data[i + 1] = v;
    noiseData.data[i + 2] = v;
    noiseData.data[i + 3] = Math.random() * 24 * intensity;
  }
  nctx.putImageData(noiseData, 0, 0);
}

function loop(now) {
  const T = now * 0.001;
  const dt = Math.max(1, now - lastFrame);
  lastFrame = now;

  if (now - lastImpulse > 2200 + Math.random() * 2600) {
    driftImpulse = (Math.random() - .5) * .55;
    lastImpulse = now;
  }
  driftImpulse *= .968;

  if (appState === "entering" && entryProgress < 1) {
    entryProgress = Math.min(1, entryProgress + dt / ENTRY_DURATION_MS);
    if (entryProgress >= 1) {
      appState = "chamber";
    }
  }

  if (touchPulse > 0) touchPulse = Math.max(0, touchPulse - 0.018);

  if (holdActive) {
    holdMix = Math.min(1, holdMix + 0.028);
    holdGlitch = Math.min(1, holdGlitch + 0.05);
  } else {
    holdMix = Math.max(0, holdMix - 0.035);
    holdGlitch = Math.max(0, holdGlitch - 0.06);
  }

  if (holdBreak > 0) holdBreak = Math.max(0, holdBreak - 0.055);
  if (appState !== "landing") wakeMix = Math.max(0.65, wakeMix);

  const wake = Math.max(appState !== "landing" ? wakeMix * 0.65 : 0, touchPulse);
  const chamberMix = 1 - Math.pow(1 - entryProgress, 2.15);
  const pressure = Math.min(1, holdMix + holdBreak * 0.65);
  const vf = chamberVisualFactor();

  if ((appState === "entering" || appState === "chamber") && entryProgress > 0.55 && now > nextAmbientDisturbAt && ambientDisturbUntil < now) {
    ambientDisturbUntil = now + 900 + Math.random() * 800;
    nextAmbientDisturbAt = now + 18000 + Math.random() * 22000;
  }

  let intensity = 1.35 + wake * 1.4 + chamberMix * (3.8 * vf) + pressure * (1.35 * vf);
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    intensity += 0.9 * Math.max(0.2, left);
  }

  drawField(T, wake, chamberMix * vf, pressure * vf);
  drawNoise(intensity);

  const glitchKick = holdGlitch * (0.35 + Math.random() * 0.65);
  const dx = Math.sin(T * .19) * (.18 + wake * 0.14 + chamberMix * (0.10 * vf) + pressure * (0.11 * vf)) + driftImpulse + Math.sin(T * 8.0) * glitchKick * (1.4 * vf);
  const dy = Math.cos(T * .17) * (.24 + wake * 0.12 + chamberMix * (0.10 * vf) + pressure * (0.10 * vf)) + driftImpulse * .42 + Math.cos(T * 6.8) * glitchKick * (1.1 * vf);
  const scaleY = 1 - chamberMix * .05 - wake * 0.01 - pressure * 0.02;
  const scaleX = 1 - chamberMix * .01 + pressure * 0.004;
  const microWarp = Math.sin(T * 0.6) * (0.18 + wake * 0.20 + pressure * 0.18) + Math.cos(T * 0.4) * (0.16 + wake * 0.18 + pressure * 0.18);
  const textDx = dx * (1 - chamberMix * .10);
  const textDy = dy * (1 - chamberMix * .08);
  const baseOpacity = Math.max(0.08, 0.82 + wake * 0.08 - chamberMix * 0.56 - pressure * 0.14);
  const flicker = Math.sin(T * (1.7 + wake * 0.9 + pressure * 1.5)) * (0.015 + wake * 0.02 + pressure * 0.03);

  landingText.style.transform = `translate(calc(-50% + ${textDx}px), calc(-50% + ${textDy}px)) scaleX(${scaleX}) scaleY(${scaleY}) skewX(${microWarp}deg)`;
  landingText.style.letterSpacing = `${0.028 - chamberMix * 0.008 + wake * 0.004 + pressure * 0.004}em`;
  landingText.style.opacity = `${Math.max(0.04, baseOpacity + flicker)}`;
  landingText.style.filter = `blur(${0.52 + chamberMix * 0.44 + wake * 0.06 + pressure * 0.12}px)`;

  let brightness = 1 + wake * 0.08 - chamberMix * (0.06 * vf) + pressure * (0.045 * vf);
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    brightness -= left * 0.035;
  }
  document.body.style.filter = `brightness(${brightness})`;

  const videoMix = Math.max(0, Math.pow(Math.max(0, (entryProgress - 0.14) / 0.86), 1.2));
  if (!video.paused || videoMix > 0.001) {
    const jitter = holdGlitch * (Math.random() > 0.78 ? 0.09 : 0);
    const videoOpacity = 0.02 + videoMix * 0.84 + Math.sin(T * 0.19) * 0.007 + jitter;
    video.style.opacity = Math.max(0, Math.min(0.92, videoOpacity)).toFixed(3);

    const videoBrightness = 0.90 + Math.sin(T * 0.12 + 0.8) * 0.018 + pressure * 0.04;
    const videoContrast = 1.10 + Math.sin(T * 0.09) * 0.02 + pressure * (0.12 * vf);
    video.style.filter = `blur(${2.6 - videoMix * 0.9 - pressure * 0.5}px) contrast(${videoContrast}) brightness(${videoBrightness}) saturate(.78)`;
  }

  chamberMeta.style.opacity = `${Math.max(0, Math.min(0.92, (entryProgress - 0.18) / 0.50))}`;
  chamberMeta.style.transform = `translateX(-50%) translateY(${Math.sin(T * 0.9) * (0.6 + pressure * 1.2)}px)`;

  let splashVol = 0;
  let chamberVol = 0;

  if (splashStarted) {
    if (appState === "woken") {
      splashVol = splashTargetVolume * (0.42 + wake * 0.5);
    } else if (appState === "entering" || appState === "chamber") {
      const cross = Math.pow(entryProgress, 1.08);
      splashVol = Math.max(0, splashTargetVolume * (1 - cross));
    }
    splashAudio.volume = Math.min(1, splashVol);
  }

  if (chamberStarted) {
    if (appState === "entering" || appState === "chamber") {
      const chamberCross = Math.pow(Math.max(0, (entryProgress - 0.10) / 0.90), 1.65);
      chamberVol = Math.max(0, chamberTargetVolume * chamberCross);
      chamberVol += pressure * (0.09 * vf);
      chamberVol += Math.sin(T * (0.8 + pressure * 1.2)) * pressure * 0.025;
    }
    chamberAudio.volume = Math.max(0, Math.min(1, chamberVol));
  }

  requestAnimationFrame(loop);
}

resize();
setChamber(0);
requestAnimationFrame(loop);
