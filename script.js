const bg = document.getElementById("bg");
const bctx = bg.getContext("2d");
const noise = document.getElementById("noise");
const nctx = noise.getContext("2d");
const t = document.getElementById("text");
const vid = document.getElementById("video");
const splashEl = document.getElementById("splashAudio");
const chamberEl = document.getElementById("chamberAudio");

vid.src = "video.mp4";
splashEl.src = "splash.mp3";
chamberEl.src = "audio.mp3";

let w = 0, h = 0;
let noiseData;

let entered = false;
let holdStart = null;
let holding = false;
let splashStarted = false;

let driftImpulse = 0;
let lastImpulse = 0;
let ambientDisturbUntil = 0;
let nextAmbientDisturbAt = 0;

let preArrivalStart = null;
const preArrivalDuration = 1700;
let arrivalStart = null;
const arrivalDuration = 9000;
let exitStart = null;
const exitDuration = 9000;

let chamberMix = 0;
let chamberTargetMix = 0;

const splashTargetVolume = 0.52;
const chamberTargetVolume = 0.56;

// Web Audio
let audioCtx = null;
let splashSource = null;
let chamberSource = null;
let masterGain = null;
let splashGain = null;
let chamberGain = null;
let audioReady = false;

function resize() {
  w = window.innerWidth;
  h = window.innerHeight;
  bg.width = w;
  bg.height = h;
  noise.width = w;
  noise.height = h;
  noiseData = nctx.createImageData(w, h);
}
window.addEventListener("resize", resize);

function drawField(T) {
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
    const x = w * m[0] + Math.sin(T * (0.08 + i * 0.02) + i) * w * 0.045;
    const y = h * m[1] + Math.cos(T * (0.06 + i * 0.015) + i * 0.8) * h * 0.04;
    const r = Math.max(w, h) * m[2] * (1 + Math.sin(T * (0.12 + i * 0.02) + i) * 0.09);

    const grad = bctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${m[3]}, ${m[3]}, ${m[3]}, 0.15)`);
    grad.addColorStop(0.32, `rgba(${Math.max(40, m[3]-75)}, ${Math.max(40, m[3]-75)}, ${Math.max(40, m[3]-75)}, 0.12)`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = grad;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  const gx = w * (0.5 + Math.sin(T * 0.05) * 0.028);
  const gy = h * (0.54 + Math.cos(T * 0.045) * 0.025);
  const gr = Math.max(w, h) * 0.44;
  const redGlow = bctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  redGlow.addColorStop(0, "rgba(108, 14, 14, 0.08)");
  redGlow.addColorStop(0.46, "rgba(54, 8, 8, 0.04)");
  redGlow.addColorStop(1, "rgba(0,0,0,0)");
  bctx.fillStyle = redGlow;
  bctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 3; i++) {
    const x = w * (0.28 + i * 0.2) + Math.sin(T * (0.1 + i * 0.03) + i) * w * 0.03;
    const y = h * (0.33 + i * 0.16) + Math.cos(T * (0.09 + i * 0.02) + i) * h * 0.04;
    const r = Math.max(w, h) * (0.12 + i * 0.025);
    const grad = bctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(230,230,230,0.035)");
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
    noiseData.data[i + 3] = Math.random() * 22 * intensity;
  }
  nctx.putImageData(noiseData, 0, 0);
}

async function setupAudio() {
  if (audioReady) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  masterGain = audioCtx.createGain();
  splashGain = audioCtx.createGain();
  chamberGain = audioCtx.createGain();

  splashGain.gain.value = 0;
  chamberGain.gain.value = 0;
  masterGain.gain.value = 1;

  splashSource = audioCtx.createMediaElementSource(splashEl);
  chamberSource = audioCtx.createMediaElementSource(chamberEl);

  splashSource.connect(splashGain);
  chamberSource.connect(chamberGain);
  splashGain.connect(masterGain);
  chamberGain.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  audioReady = true;
}

function setGainSmooth(gainNode, value, seconds = 3.0) {
  if (!audioCtx || !gainNode) return;
  const now = audioCtx.currentTime;
  const current = Math.max(0.0001, gainNode.gain.value);
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(current, now);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, value), now + seconds);
}

async function ensureSplashStarted() {
  await setupAudio();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
  if (splashStarted) return;
  splashStarted = true;

  splashEl.loop = True
  splashEl.loop = true;
  chamberEl.loop = true;

  splashEl.volume = 1;
  chamberEl.volume = 1;

  try { await splashEl.play(); } catch (e) {}
  try {
    await chamberEl.play();
    chamberEl.pause();
    chamberEl.currentTime = 0;
  } catch (e) {}

  setGainSmooth(splashGain, splashTargetVolume * 0.72, 2.5);
}

function beginPreArrival(now) {
  if (preArrivalStart !== null || entered) return;
  preArrivalStart = now;
  exitStart = null;

  if (chamberEl.readyState >= 1) {
    try {
      if (chamberEl.duration && isFinite(chamberEl.duration) && chamberEl.duration > 0) {
        chamberEl.currentTime = Math.random() * chamberEl.duration;
      }
    } catch (e) {}
  } else {
    chamberEl.addEventListener("loadedmetadata", () => {
      try {
        if (chamberEl.duration && isFinite(chamberEl.duration) && chamberEl.duration > 0) {
          chamberEl.currentTime = Math.random() * chamberEl.duration;
        }
      } catch (e) {}
    }, { once: true });
  }

  chamberEl.volume = 1;
  chamberEl.play().catch(() => {});

  if (vid.readyState >= 1) {
    try {
      if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
        vid.currentTime = Math.random() * vid.duration;
      }
    } catch (e) {}
  } else {
    vid.addEventListener("loadedmetadata", () => {
      try {
        if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
          vid.currentTime = Math.random() * vid.duration;
        }
      } catch (e) {}
    }, { once: true });
  }
  vid.playbackRate = 0.92;
  vid.play().catch(() => {});
}

function completeArrival(now) {
  entered = true;
  arrivalStart = now;
  exitStart = null;
  chamberTargetMix = 1;
  nextAmbientDisturbAt = now + 18000 + Math.random() * 22000;
}

function beginExit(now) {
  if (exitStart !== null) return;
  exitStart = now;
  chamberTargetMix = 0;
}

function startHold(e) {
  if (entered) return;
  if (e.cancelable) e.preventDefault();
  holding = true;
  holdStart = performance.now();
  ensureSplashStarted();
}

function endHold(e) {
  if (e && e.cancelable) e.preventDefault();
  if (!entered) {
    holding = false;
    holdStart = null;
    return;
  }
  beginExit(performance.now());
}

document.addEventListener("contextmenu", e => e.preventDefault());
document.body.addEventListener("pointerdown", startHold, { passive: false });
document.body.addEventListener("pointerup", endHold, { passive: false });
document.body.addEventListener("pointercancel", endHold, { passive: false });
document.body.addEventListener("pointerleave", endHold, { passive: false });
document.body.addEventListener("touchstart", startHold, { passive: false });
document.body.addEventListener("touchend", endHold, { passive: false });
document.body.addEventListener("touchcancel", endHold, { passive: false });

function loop(now) {
  const T = now * 0.001;
  drawField(T);

  if (now - lastImpulse > 2600 + Math.random() * 3200) {
    driftImpulse = (Math.random() - .5) * .42;
    lastImpulse = now;
  }
  driftImpulse *= .965;

  let raw = 0;
  if (holding && holdStart && !entered) {
    raw = Math.min(1, (now - holdStart) / 5000);
  }
  const progress = Math.pow(raw, 3.2);

  // smooth chamber presence
  const dt = 16;
  const fadeInRate = Math.min(1, (dt / arrivalDuration) * 1.55);
  const fadeOutRate = Math.min(1, (dt / exitDuration) * 1.55);
  if (chamberTargetMix > chamberMix) {
    chamberMix += (chamberTargetMix - chamberMix) * fadeInRate;
  } else if (chamberTargetMix < chamberMix) {
    chamberMix += (chamberTargetMix - chamberMix) * fadeOutRate;
  }

  if (!entered && preArrivalStart === null && progress > 0.72) {
    beginPreArrival(now);
  }
  if (!entered && progress > 0.95 && preArrivalStart !== null) {
    completeArrival(now);
  }

  if (entered && now > nextAmbientDisturbAt && ambientDisturbUntil < now) {
    ambientDisturbUntil = now + 1000 + Math.random() * 700;
    nextAmbientDisturbAt = now + 20000 + Math.random() * 26000;
  }

  let intensity = 1.25 + progress * 4.2;
  let preMix = 0;
  if (preArrivalStart !== null && !entered) {
    preMix = Math.min(1, (now - preArrivalStart) / preArrivalDuration);
    intensity += 0.9 + preMix * 2.2;
  }
  if (entered) intensity = 1.55;
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    intensity += 0.9 * Math.max(0.2, left);
  }
  drawNoise(intensity);

  const dx = Math.sin(T * .19) * .16 + driftImpulse;
  const dy = Math.cos(T * .17) * .22 + driftImpulse * .42;
  const scaleY = 1 - progress * .05;
  const scaleX = 1 - progress * .01;
  const textDx = dx * (1 - progress * .10);
  const textDy = dy * (1 - progress * .08);

  t.style.transform = `translate(calc(-50% + ${textDx}px), calc(-50% + ${textDy}px)) scaleX(${scaleX}) scaleY(${scaleY})`;
  t.style.letterSpacing = `${0.028 - progress * 0.008}em`;

  let textOpacity = 0.42 + progress * 0.18;
  let textBlur = 0.72 - progress * 0.22;
  if (preArrivalStart !== null && !entered) {
    textOpacity = 0.48 - preMix * 0.22;
    textBlur = 0.62 + preMix * 0.35;
  }
  if (entered || chamberMix > 0.01) {
    textOpacity = Math.max(0.04, 0.26 - chamberMix * 0.22);
    textBlur = 0.92 + chamberMix * 0.18;
  }
  t.style.opacity = `${Math.max(0.04, textOpacity)}`;
  t.style.filter = `blur(${Math.max(0.4, textBlur)}px)`;

  let brightness = 1 - progress * 0.08;
  if (preArrivalStart !== null && !entered) brightness -= preMix * 0.08;
  if (entered && now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    brightness -= left * 0.035;
  }
  document.body.style.filter = `brightness(${brightness})`;

  // audio via Web Audio
  if (audioReady) {
    if (!entered && splashStarted) {
      let splashVol = splashTargetVolume * (0.72 + progress * 0.16);
      if (preArrivalStart !== null) splashVol *= (1 - preMix * 0.42);
      if (chamberMix > 0.001) splashVol *= (1 - chamberMix * 0.35);
      splashGain.gain.value = Math.max(0.0001, splashVol);
    }

    if (preArrivalStart !== null) {
      const traceVol = !entered ? preMix * 0.03 : 0;
      const wobble = Math.sin(T * 0.37) * 0.003;
      const chamberVol = Math.max(traceVol, chamberMix * chamberTargetVolume + wobble);
      chamberGain.gain.value = Math.max(0.0001, Math.min(chamberTargetVolume, chamberVol));

      if (exitStart !== null && chamberMix <= 0.004) {
        entered = false;
        holding = false;
        holdStart = null;
        preArrivalStart = null;
        arrivalStart = null;
        exitStart = null;
        chamberTargetMix = 0;
        chamberMix = 0;
        ambientDisturbUntil = 0;
        nextAmbientDisturbAt = 0;

        try { chamberEl.pause(); } catch (e) {}
        chamberEl.currentTime = 0;
        chamberGain.gain.value = 0.0001;
        vid.style.opacity = 0;
      }
    }
  }

  // video follows chamber mix
  if (preArrivalStart !== null) {
    const traceMix = !entered ? preMix * 0.08 : 0;
    const vidMix = Math.max(traceMix, chamberMix);

    const videoOpacity = 0.03 + vidMix * 0.82 + Math.sin(T * 0.19) * 0.008;
    vid.style.opacity = Math.max(0, Math.min(0.86, videoOpacity)).toFixed(3);

    const videoBrightness = 0.89 + Math.sin(T * 0.12 + 0.8) * 0.018 - (preMix * 0.008);
    const videoContrast = 1.10 + Math.sin(T * 0.09) * 0.02;
    vid.style.filter = `blur(${2.5 - vidMix * 0.75}px) contrast(${videoContrast}) brightness(${videoBrightness}) saturate(.78)`;
  }

  requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);
