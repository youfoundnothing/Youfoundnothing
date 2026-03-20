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

let driftImpulse = 0;
let lastImpulse = 0;
let ambientDisturbUntil = 0;
let nextAmbientDisturbAt = 0;

// simple on/off switch behavior
let isPressing = false;
let audioStarted = false;
let progress = 0;        // 0 = splash, 1 = chamber
let targetProgress = 0;  // follows press / release
const transitionMs = 9000;

// tiny pre-trace so chamber feels present but not activated
const traceFloor = 0.025;

// Web Audio
let audioCtx = null;
let splashSource = null;
let chamberSource = null;
let masterGain = null;
let splashGain = null;
let chamberGain = null;

const splashTargetVolume = 0.52;
const chamberTargetVolume = 0.56;

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
  if (audioStarted) {
    if (audioCtx && audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    return;
  }

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  splashEl.loop = true;
  chamberEl.loop = true;
  splashEl.volume = 1;
  chamberEl.volume = 1;
  splashEl.muted = false;
  chamberEl.muted = false;

  masterGain = audioCtx.createGain();
  splashGain = audioCtx.createGain();
  chamberGain = audioCtx.createGain();

  splashGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  chamberGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  masterGain.gain.setValueAtTime(1, audioCtx.currentTime);

  splashSource = audioCtx.createMediaElementSource(splashEl);
  chamberSource = audioCtx.createMediaElementSource(chamberEl);

  splashSource.connect(splashGain);
  chamberSource.connect(chamberGain);
  splashGain.connect(masterGain);
  chamberGain.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  // start both during the gesture so iPhone fully unlocks them
  try { await splashEl.play(); } catch (e) {}
  try { await chamberEl.play(); } catch (e) {}

  // chamber stays running silently in the background
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

  splashGain.gain.setTargetAtTime(splashTargetVolume * 0.72, audioCtx.currentTime, 0.18);
  chamberGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.18);

  audioStarted = true;
}

async function startPress(e) {
  if (e && e.cancelable) e.preventDefault();
  isPressing = true;
  targetProgress = 1;
  await setupAudio();

  if (vid.paused) {
    if (vid.readyState >= 1) {
      try {
        if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
          vid.currentTime = Math.random() * vid.duration;
        }
      } catch (err) {}
    } else {
      vid.addEventListener("loadedmetadata", () => {
        try {
          if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
            vid.currentTime = Math.random() * vid.duration;
          }
        } catch (err) {}
      }, { once: true });
    }
    vid.playbackRate = 0.92;
    vid.play().catch(() => {});
  }
}

function endPress(e) {
  if (e && e.cancelable) e.preventDefault();
  isPressing = false;
  targetProgress = 0;
}

document.addEventListener("contextmenu", e => e.preventDefault());
document.body.addEventListener("pointerdown", startPress, { passive: false });
document.body.addEventListener("pointerup", endPress, { passive: false });
document.body.addEventListener("pointercancel", endPress, { passive: false });
document.body.addEventListener("pointerleave", endPress, { passive: false });
document.body.addEventListener("touchstart", startPress, { passive: false });
document.body.addEventListener("touchend", endPress, { passive: false });
document.body.addEventListener("touchcancel", endPress, { passive: false });

let lastFrame = performance.now();

function loop(now) {
  const T = now * 0.001;
  const dtMs = Math.max(1, now - lastFrame);
  lastFrame = now;

  drawField(T);

  if (now - lastImpulse > 2600 + Math.random() * 3200) {
    driftImpulse = (Math.random() - .5) * .42;
    lastImpulse = now;
  }
  driftImpulse *= .965;

  // true time-based 9-second fade both directions
  const step = dtMs / transitionMs;
  if (targetProgress > progress) {
    progress = Math.min(targetProgress, progress + step);
  } else if (targetProgress < progress) {
    progress = Math.max(targetProgress, progress - step);
  }

  // subtle ambient disturbances only when mostly "in"
  if (progress > 0.7 && now > nextAmbientDisturbAt && ambientDisturbUntil < now) {
    ambientDisturbUntil = now + 1000 + Math.random() * 700;
    nextAmbientDisturbAt = now + 20000 + Math.random() * 26000;
  }

  const eased = 1 - Math.pow(1 - progress, 2.2);
  const traceMix = progress > 0 ? traceFloor : 0;
  const visibleMix = Math.max(traceMix, eased);

  let intensity = 1.25 + eased * 4.2;
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    intensity += 0.9 * Math.max(0.2, left);
  }
  drawNoise(intensity);

  const dx = Math.sin(T * .19) * .16 + driftImpulse;
  const dy = Math.cos(T * .17) * .22 + driftImpulse * .42;
  const scaleY = 1 - eased * .05;
  const scaleX = 1 - eased * .01;
  const textDx = dx * (1 - eased * .10);
  const textDy = dy * (1 - eased * .08);

  t.style.transform = `translate(calc(-50% + ${textDx}px), calc(-50% + ${textDy}px)) scaleX(${scaleX}) scaleY(${scaleY})`;
  t.style.letterSpacing = `${0.028 - eased * 0.008}em`;
  const textOpacity = Math.max(0.04, 0.42 - eased * 0.38);
  const textBlur = 0.72 + eased * 0.32;
  t.style.opacity = `${textOpacity}`;
  t.style.filter = `blur(${textBlur}px)`;

  let brightness = 1 - eased * 0.08;
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    brightness -= left * 0.035;
  }
  document.body.style.filter = `brightness(${brightness})`;

  // smooth video tied to same switch
  if (!vid.paused || progress > 0.001) {
    const videoOpacity = 0.03 + visibleMix * 0.82 + Math.sin(T * 0.19) * 0.008;
    vid.style.opacity = Math.max(0, Math.min(0.86, videoOpacity)).toFixed(3);

    const videoBrightness = 0.89 + Math.sin(T * 0.12 + 0.8) * 0.018;
    const videoContrast = 1.10 + Math.sin(T * 0.09) * 0.02;
    vid.style.filter = `blur(${2.5 - visibleMix * 0.75}px) contrast(${videoContrast}) brightness(${videoBrightness}) saturate(.78)`;
  }

  // true smooth audio via Web Audio
  if (audioStarted && splashGain && chamberGain && audioCtx) {
    const splashVol = Math.max(0.0001, splashTargetVolume * (0.72 - eased * 0.42));
    const chamberVol = Math.max(0.0001, chamberTargetVolume * eased);

    const nowAudio = audioCtx.currentTime;
    splashGain.gain.setTargetAtTime(splashVol, nowAudio, 0.12);
    chamberGain.gain.setTargetAtTime(chamberVol, nowAudio, 0.12);
  }

  requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);
