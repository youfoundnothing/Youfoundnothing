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
    audio: "audio.mp3",
    video: "video.mp4"
  }
];

const ENTRY_DURATION_MS = 9000;
const HOLD_THRESHOLD_MS = 380;

let w = 0, h = 0;
let noiseData;

let appState = "landing"; // landing, woken, entering, chamber
let activeChamber = 0;
let entryProgress = 0;

let splashStarted = false;
let chamberStarted = false;
let audioUnlocked = false;

let pointerDown = false;
let pointerStart = 0;
let holdTimer = null;
let holdActive = false;
let activePointerId = null;
let suppressTapUntil = 0;

let touchPulse = 0;
let wakeMix = 0;
let holdMix = 0;
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

async function unlockAudioContext() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  splashAudio.muted = false;
  chamberAudio.muted = false;
  splashAudio.volume = 0;
  chamberAudio.volume = 0;
}

async function startSplashIfNeeded() {
  await unlockAudioContext();
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
  await unlockAudioContext();
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
    holdMix = Math.max(holdMix, 0.45);
  }
}

function clearHoldTimer() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}

async function handleTap() {
  const now = performance.now();
  if (now < suppressTapUntil) return;

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
  pointerStart = performance.now();
  touchPulse = 1;

  if (appState === "chamber") {
    clearHoldTimer();
    holdTimer = setTimeout(() => {
      if (pointerDown && appState === "chamber") {
        suppressTapUntil = performance.now() + 220;
        intensifyChamber(true);
      }
    }, HOLD_THRESHOLD_MS);
  }
}

async function onPointerUp(e) {
  if (e && e.cancelable) e.preventDefault();
  const pid = e.pointerId ?? "mouse";
  if (!pointerDown || activePointerId !== pid) return;

  pointerDown = false;
  activePointerId = null;
  clearHoldTimer();

  if (holdActive) {
    intensifyChamber(false);
    return;
  }

  await handleTap();
}

function onPointerCancel(e) {
  if (e && e.cancelable) e.preventDefault();
  pointerDown = false;
  activePointerId = null;
  clearHoldTimer();
  if (holdActive) intensifyChamber(false);
}

document.addEventListener("contextmenu", e => e.preventDefault());
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
    const x = w * m[0] + Math.sin(T * (0.08 + i * 0.02) + i) * w * (0.046 + wake * 0.014 + chamber * 0.012 + hold * 0.015);
    const y = h * m[1] + Math.cos(T * (0.06 + i * 0.015) + i * 0.8) * h * (0.042 + wake * 0.010 + chamber * 0.010 + hold * 0.014);
    const r = Math.max(w, h) * m[2] * (1 + Math.sin(T * (0.12 + i * 0.02) + i) * (0.09 + wake * 0.07 + chamber * 0.05 + hold * 0.06));

    const core = Math.min(242, m[3] + wake * 28 + chamber * 16 + hold * 16);
    const grad = bctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${core}, ${core - 8}, ${core - 8}, ${0.20 + wake * 0.08 + chamber * 0.04 + hold * 0.05})`);
    grad.addColorStop(0.34, `rgba(${Math.max(55, core-92)}, ${Math.max(55, core-92)}, ${Math.max(55, core-92)}, ${0.15 + wake * 0.03 + hold * 0.04})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = grad;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  const gx = w * (0.5 + Math.sin(T * 0.05) * 0.028);
  const gy = h * (0.54 + Math.cos(T * 0.045) * 0.025);
  const gr = Math.max(w, h) * (0.44 + wake * 0.025 + chamber * 0.01 + hold * 0.012);
  const redGlow = bctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  redGlow.addColorStop(0, `rgba(118, 18, 18, ${0.10 + wake * 0.06 + hold * 0.04})`);
  redGlow.addColorStop(0.46, `rgba(54, 8, 8, ${0.05 + wake * 0.02 + hold * 0.02})`);
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

  if (touchPulse > 0) {
    touchPulse = Math.max(0, touchPulse - 0.018);
  }

  if (holdActive) {
    holdMix = Math.min(1, holdMix + 0.03);
  } else {
    holdMix = Math.max(0, holdMix - 0.04);
  }

  if (appState !== "landing") {
    wakeMix = Math.max(0.65, wakeMix);
  }

  const wake = Math.max(appState !== "landing" ? wakeMix * 0.65 : 0, touchPulse);
  const chamberMix = 1 - Math.pow(1 - entryProgress, 2.15);

  if ((appState === "entering" || appState === "chamber") && entryProgress > 0.55 && now > nextAmbientDisturbAt && ambientDisturbUntil < now) {
    ambientDisturbUntil = now + 900 + Math.random() * 800;
    nextAmbientDisturbAt = now + 18000 + Math.random() * 22000;
  }

  let intensity = 1.35 + wake * 1.4 + chamberMix * 3.8 + holdMix * 0.9;
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    intensity += 0.9 * Math.max(0.2, left);
  }

  drawField(T, wake, chamberMix, holdMix);
  drawNoise(intensity);

  const dx = Math.sin(T * .19) * (.18 + wake * 0.14 + chamberMix * 0.10 + holdMix * 0.08) + driftImpulse;
  const dy = Math.cos(T * .17) * (.24 + wake * 0.12 + chamberMix * 0.10 + holdMix * 0.08) + driftImpulse * .42;
  const scaleY = 1 - chamberMix * .05 - wake * 0.01;
  const scaleX = 1 - chamberMix * .01;
  const microWarp = Math.sin(T * 0.6) * (0.18 + wake * 0.20 + holdMix * 0.10) + Math.cos(T * 0.4) * (0.16 + wake * 0.18 + holdMix * 0.10);
  const textDx = dx * (1 - chamberMix * .10);
  const textDy = dy * (1 - chamberMix * .08);
  const baseOpacity = Math.max(0.08, 0.82 + wake * 0.08 - chamberMix * 0.56);
  const flicker = Math.sin(T * (1.7 + wake * 0.9 + holdMix * 0.6)) * (0.015 + wake * 0.02 + holdMix * 0.01);

  landingText.style.transform = `translate(calc(-50% + ${textDx}px), calc(-50% + ${textDy}px)) scaleX(${scaleX}) scaleY(${scaleY}) skewX(${microWarp}deg)`;
  landingText.style.letterSpacing = `${0.028 - chamberMix * 0.008 + wake * 0.004}em`;
  landingText.style.opacity = `${Math.max(0.06, baseOpacity + flicker)}`;
  landingText.style.filter = `blur(${0.52 + chamberMix * 0.44 + wake * 0.06}px)`;

  let brightness = 1 + wake * 0.08 - chamberMix * 0.06 + holdMix * 0.03;
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    brightness -= left * 0.035;
  }
  document.body.style.filter = `brightness(${brightness})`;

  const videoMix = Math.max(0, Math.pow(Math.max(0, (entryProgress - 0.14) / 0.86), 1.2));
  if (!video.paused || videoMix > 0.001) {
    const videoOpacity = 0.02 + videoMix * 0.84 + Math.sin(T * 0.19) * 0.007;
    video.style.opacity = Math.max(0, Math.min(0.88, videoOpacity)).toFixed(3);

    const videoBrightness = 0.90 + Math.sin(T * 0.12 + 0.8) * 0.018;
    const videoContrast = 1.10 + Math.sin(T * 0.09) * 0.02 + holdMix * 0.04;
    video.style.filter = `blur(${2.6 - videoMix * 0.9 - holdMix * 0.25}px) contrast(${videoContrast}) brightness(${videoBrightness}) saturate(.78)`;
  }

  chamberMeta.style.opacity = `${Math.max(0, Math.min(0.92, (entryProgress - 0.18) / 0.50))}`;
  chamberMeta.style.transform = `translateX(-50%) translateY(${Math.sin(T * 0.9) * 0.6}px)`;

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
      chamberVol = Math.max(0, chamberTargetVolume * chamberCross) + holdMix * 0.06;
    }
    chamberAudio.volume = Math.min(1, chamberVol);
  }

  requestAnimationFrame(loop);
}

resize();
setChamber(0);
requestAnimationFrame(loop);
