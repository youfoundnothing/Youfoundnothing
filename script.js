const bg = document.getElementById("bg");
const bctx = bg.getContext("2d");
const noise = document.getElementById("noise");
const nctx = noise.getContext("2d");
const text = document.getElementById("text");
const chamberTitle = document.getElementById("chamberTitle");
const video = document.getElementById("video");
const splashAudio = document.getElementById("splashAudio");
const chamberAudio = document.getElementById("chamberAudio");

video.src = "video.mp4";
splashAudio.src = "splash.mp3";
chamberAudio.src = "audio.mp3";

let w = 0, h = 0;
let noiseData;

let stage = 0; // 0 landing, 1 splash-woken, 2 chamber transition/chamber
let transitionProgress = 0;
const transitionMs = 9000;

let splashReady = false;
let chamberStarted = false;
let pointerIsDown = false;
let activePointerId = null;
let pressVisual = 0;
let wakeLevel = 0;
let driftImpulse = 0;
let lastImpulse = 0;
let ambientDisturbUntil = 0;
let nextAmbientDisturbAt = 0;
let lastFrame = performance.now();

// hard gate so one quick tap can never count as both first and second press
let stageCooldownUntil = 0;
const interStageCooldownMs = 700;

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

async function startSplashIfNeeded() {
  if (splashReady) return;
  splashReady = true;
  splashAudio.muted = false;
  splashAudio.volume = 0;
  try {
    splashAudio.currentTime = 0;
    await splashAudio.play();
  } catch (e) {
    console.error("splash play failed", e);
  }
}

async function startChamberIfNeeded() {
  if (chamberStarted) return;
  chamberStarted = true;
  chamberAudio.muted = false;
  chamberAudio.volume = 0;
  try {
    await chamberAudio.play();
    try {
      if (chamberAudio.readyState >= 1 && chamberAudio.duration && isFinite(chamberAudio.duration) && chamberAudio.duration > 0) {
        chamberAudio.currentTime = Math.random() * chamberAudio.duration;
      }
    } catch (e) {}
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

function onPointerDown(e) {
  if (e && e.cancelable) e.preventDefault();
  if (pointerIsDown) return;
  pointerIsDown = true;
  activePointerId = e.pointerId ?? "mouse";
  pressVisual = 1;
}

async function onPointerUp(e) {
  if (e && e.cancelable) e.preventDefault();
  const pid = e.pointerId ?? "mouse";
  if (!pointerIsDown || activePointerId !== pid) return;

  pointerIsDown = false;
  activePointerId = null;

  const now = performance.now();
  if (now < stageCooldownUntil) {
    return;
  }

  // First completed press = splash only
  if (stage === 0) {
    stage = 1;
    wakeLevel = 1;
    stageCooldownUntil = now + interStageCooldownMs;
    await startSplashIfNeeded();
    splashAudio.volume = splashTargetVolume * 0.55;
    chamberAudio.volume = 0;
    return;
  }

  // Second completed press = chamber begins
  if (stage === 1) {
    stage = 2;
    stageCooldownUntil = now + interStageCooldownMs;
    await startSplashIfNeeded();
    await startChamberIfNeeded();
    await startVideoIfNeeded();
    return;
  }
}

document.addEventListener("contextmenu", e => e.preventDefault());
document.body.addEventListener("pointerdown", onPointerDown, { passive: false });
document.body.addEventListener("pointerup", onPointerUp, { passive: false });
document.body.addEventListener("pointercancel", onPointerUp, { passive: false });

function drawField(T, wakeMix, chamberMix) {
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
    const x = w * m[0] + Math.sin(T * (0.08 + i * 0.02) + i) * w * (0.045 + wakeMix * 0.012 + chamberMix * 0.01);
    const y = h * m[1] + Math.cos(T * (0.06 + i * 0.015) + i * 0.8) * h * (0.04 + wakeMix * 0.01 + chamberMix * 0.01);
    const r = Math.max(w, h) * m[2] * (1 + Math.sin(T * (0.12 + i * 0.02) + i) * (0.09 + wakeMix * 0.06 + chamberMix * 0.04));

    const core = Math.min(240, m[3] + wakeMix * 24 + chamberMix * 16);
    const grad = bctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${core}, ${core - 8}, ${core - 8}, ${0.19 + wakeMix * 0.08 + chamberMix * 0.03})`);
    grad.addColorStop(0.34, `rgba(${Math.max(55, core-90)}, ${Math.max(55, core-90)}, ${Math.max(55, core-90)}, ${0.15 + wakeMix * 0.03})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = grad;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  const gx = w * (0.5 + Math.sin(T * 0.05) * 0.028);
  const gy = h * (0.54 + Math.cos(T * 0.045) * 0.025);
  const gr = Math.max(w, h) * (0.44 + wakeMix * 0.025 + chamberMix * 0.01);
  const redGlow = bctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  redGlow.addColorStop(0, `rgba(118, 18, 18, ${0.10 + wakeMix * 0.06})`);
  redGlow.addColorStop(0.46, `rgba(54, 8, 8, ${0.05 + wakeMix * 0.02})`);
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

  if (stage === 2 && transitionProgress < 1) {
    transitionProgress = Math.min(1, transitionProgress + dt / transitionMs);
  }

  if (pressVisual > 0) {
    pressVisual = Math.max(0, pressVisual - 0.018);
  }

  const wakeMix = Math.max(stage >= 1 ? wakeLevel * 0.65 : 0, pressVisual);
  const chamberMix = 1 - Math.pow(1 - transitionProgress, 2.15);

  if (stage === 2 && transitionProgress > 0.55 && now > nextAmbientDisturbAt && ambientDisturbUntil < now) {
    ambientDisturbUntil = now + 900 + Math.random() * 800;
    nextAmbientDisturbAt = now + 18000 + Math.random() * 22000;
  }

  let intensity = 1.35 + wakeMix * 1.4 + chamberMix * 3.8;
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    intensity += 0.9 * Math.max(0.2, left);
  }

  drawField(T, wakeMix, chamberMix);
  drawNoise(intensity);

  const dx = Math.sin(T * .19) * (.18 + wakeMix * 0.14 + chamberMix * 0.10) + driftImpulse;
  const dy = Math.cos(T * .17) * (.24 + wakeMix * 0.12 + chamberMix * 0.10) + driftImpulse * .42;
  const scaleY = 1 - chamberMix * .05 - wakeMix * 0.01;
  const scaleX = 1 - chamberMix * .01;
  const microWarp = Math.sin(T * 0.6) * (0.18 + wakeMix * 0.20) + Math.cos(T * 0.4) * (0.16 + wakeMix * 0.18);
  const textDx = dx * (1 - chamberMix * .10);
  const textDy = dy * (1 - chamberMix * .08);
  const baseOpacity = Math.max(0.08, 0.78 + wakeMix * 0.10 - chamberMix * 0.52);
  const flicker = Math.sin(T * (1.7 + wakeMix * 0.9)) * (0.015 + wakeMix * 0.02);

  text.style.transform = `translate(calc(-50% + ${textDx}px), calc(-50% + ${textDy}px)) scaleX(${scaleX}) scaleY(${scaleY}) skewX(${microWarp}deg)`;
  text.style.letterSpacing = `${0.028 - chamberMix * 0.008 + wakeMix * 0.004}em`;
  text.style.opacity = `${Math.max(0.06, baseOpacity + flicker)}`;
  text.style.filter = `blur(${0.55 + chamberMix * 0.42 + wakeMix * 0.05}px)`;

  let brightness = 1 + wakeMix * 0.08 - chamberMix * 0.06;
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    brightness -= left * 0.035;
  }
  document.body.style.filter = `brightness(${brightness})`;

  const videoMix = Math.max(0, Math.pow(Math.max(0, (transitionProgress - 0.14) / 0.86), 1.2));
  if (!video.paused || videoMix > 0.001) {
    const videoOpacity = 0.02 + videoMix * 0.84 + Math.sin(T * 0.19) * 0.007;
    video.style.opacity = Math.max(0, Math.min(0.88, videoOpacity)).toFixed(3);

    const videoBrightness = 0.90 + Math.sin(T * 0.12 + 0.8) * 0.018;
    const videoContrast = 1.10 + Math.sin(T * 0.09) * 0.02;
    video.style.filter = `blur(${2.6 - videoMix * 0.9}px) contrast(${videoContrast}) brightness(${videoBrightness}) saturate(.78)`;
  }

  chamberTitle.style.opacity = `${Math.max(0, Math.min(0.92, (transitionProgress - 0.18) / 0.50))}`;
  chamberTitle.style.transform = `translateX(-50%) translateY(${Math.sin(T * 0.9) * 0.6}px)`;

  if (splashReady) {
    let splashVol = 0;
    let chamberVol = 0;

    if (stage === 1) {
      splashVol = splashTargetVolume * (0.42 + wakeMix * 0.5);
      chamberVol = 0;
    } else if (stage === 2) {
      const cross = Math.pow(transitionProgress, 1.08);
      const chamberCross = Math.pow(Math.max(0, (transitionProgress - 0.10) / 0.90), 1.65);
      splashVol = Math.max(0, splashTargetVolume * (1 - cross));
      chamberVol = Math.max(0, chamberTargetVolume * chamberCross);
    }

    splashAudio.volume = Math.min(1, splashVol);
    chamberAudio.volume = Math.min(1, chamberVol);
  }

  requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);
