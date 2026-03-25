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

let stage = 0; // 0=landing, 1=woken splash, 2=transition/chamber
let transitionProgress = 0;
const transitionMs = 9000;

let audioReady = false;
let driftImpulse = 0;
let lastImpulse = 0;
let touchPulse = 0;
let ambientDisturbUntil = 0;
let nextAmbientDisturbAt = 0;
let lastFrame = performance.now();
let chamberPrimed = false;

// prevent iPhone double-fire from pointer + touch on one tap
let lastPressAt = 0;

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

async function prepareAudio() {
  if (audioReady) return;
  audioReady = true;

  splashAudio.muted = false;
  chamberAudio.muted = false;
  splashAudio.volume = 0;
  chamberAudio.volume = 0;

  try {
    splashAudio.currentTime = 0;
    await splashAudio.play();
  } catch (e) {
    console.error("splash play failed", e);
  }

  // Prime chamber on first interaction so second press can fade it in smoothly.
  try {
    await chamberAudio.play();
    if (chamberAudio.readyState >= 1 && chamberAudio.duration && isFinite(chamberAudio.duration) && chamberAudio.duration > 0) {
      chamberAudio.currentTime = Math.random() * chamberAudio.duration;
    }
    chamberAudio.volume = 0;
    chamberPrimed = true;
  } catch (e) {
    console.error("chamber play failed", e);
    chamberPrimed = false;
  }
}

async function onPress(e) {
  if (e && e.cancelable) e.preventDefault();

  const now = performance.now();
  if (now - lastPressAt < 350) return;
  lastPressAt = now;

  // First press: wake splash only
  if (stage === 0) {
    stage = 1;
    touchPulse = 1;
    await prepareAudio();
    splashAudio.volume = splashTargetVolume * 0.55;
    return;
  }

  // Second press: begin chamber transition
  if (stage === 1) {
    stage = 2;
    touchPulse = 1;

    // Retry chamber start here if priming failed earlier.
    if (!chamberPrimed) {
      try {
        await chamberAudio.play();
        if (chamberAudio.readyState >= 1 && chamberAudio.duration && isFinite(chamberAudio.duration) && chamberAudio.duration > 0) {
          chamberAudio.currentTime = Math.random() * chamberAudio.duration;
        }
        chamberPrimed = true;
      } catch (e) {
        console.error("second press chamber play failed", e);
      }
    }

    if (video.paused) {
      try {
        if (video.readyState >= 1 && video.duration && isFinite(video.duration) && video.duration > 0) {
          video.currentTime = Math.random() * video.duration;
        }
      } catch (e) {}
      video.playbackRate = 0.92;
      video.play().catch(() => {});
    }
  }
}

document.addEventListener("contextmenu", e => e.preventDefault());

// Use only pointerdown to avoid duplicate tap handling.
document.body.addEventListener("pointerdown", onPress, { passive: false });

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
    const x = w * m[0] + Math.sin(T * (0.08 + i * 0.02) + i) * w * (0.045 + wakeMix * 0.01 + chamberMix * 0.01);
    const y = h * m[1] + Math.cos(T * (0.06 + i * 0.015) + i * 0.8) * h * (0.04 + wakeMix * 0.008 + chamberMix * 0.01);
    const r = Math.max(w, h) * m[2] * (1 + Math.sin(T * (0.12 + i * 0.02) + i) * (0.09 + wakeMix * 0.05 + chamberMix * 0.04));

    const core = Math.min(240, m[3] + wakeMix * 22 + chamberMix * 16);
    const grad = bctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${core}, ${core - 8}, ${core - 8}, ${0.19 + wakeMix * 0.07 + chamberMix * 0.03})`);
    grad.addColorStop(0.34, `rgba(${Math.max(55, core-90)}, ${Math.max(55, core-90)}, ${Math.max(55, core-90)}, ${0.15 + wakeMix * 0.03})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = grad;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  const gx = w * (0.5 + Math.sin(T * 0.05) * 0.028);
  const gy = h * (0.54 + Math.cos(T * 0.045) * 0.025);
  const gr = Math.max(w, h) * (0.44 + wakeMix * 0.02 + chamberMix * 0.01);
  const redGlow = bctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  redGlow.addColorStop(0, `rgba(118, 18, 18, ${0.10 + wakeMix * 0.05})`);
  redGlow.addColorStop(0.46, `rgba(54, 8, 8, ${0.05 + wakeMix * 0.02})`);
  redGlow.addColorStop(1, "rgba(0,0,0,0)");
  bctx.fillStyle = redGlow;
  bctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 3; i++) {
    const x = w * (0.28 + i * 0.2) + Math.sin(T * (0.1 + i * 0.03) + i) * w * 0.03;
    const y = h * (0.33 + i * 0.16) + Math.cos(T * (0.09 + i * 0.02) + i) * h * 0.04;
    const r = Math.max(w, h) * (0.12 + i * 0.025);
    const grad = bctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(235,235,235,${0.045 + wakeMix * 0.015})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = grad;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }
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

  if (touchPulse > 0) {
    touchPulse = Math.max(0, touchPulse - 0.022);
  }

  const wakeBase = stage >= 1 ? 1 : 0;
  const wakeMix = Math.max(wakeBase * 0.65, touchPulse);
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

  if (!video.paused || chamberMix > 0.001) {
    const videoMix = Math.max(0, Math.pow(Math.max(0, (transitionProgress - 0.14) / 0.86), 1.2));
    const videoOpacity = 0.02 + videoMix * 0.84 + Math.sin(T * 0.19) * 0.007;
    video.style.opacity = Math.max(0, Math.min(0.88, videoOpacity)).toFixed(3);

    const videoBrightness = 0.90 + Math.sin(T * 0.12 + 0.8) * 0.018;
    const videoContrast = 1.10 + Math.sin(T * 0.09) * 0.02;
    video.style.filter = `blur(${2.6 - videoMix * 0.9}px) contrast(${videoContrast}) brightness(${videoBrightness}) saturate(.78)`;
  }

  chamberTitle.style.opacity = `${Math.max(0, Math.min(0.92, (transitionProgress - 0.18) / 0.50))}`;
  const metaShake = Math.sin(T * 0.9) * 0.6;
  chamberTitle.style.transform = `translateX(-50%) translateY(${metaShake}px)`;

  if (audioReady) {
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
