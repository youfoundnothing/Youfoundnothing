const bg = document.getElementById("bg");
const bctx = bg.getContext("2d");
const noise = document.getElementById("noise");
const nctx = noise.getContext("2d");
const t = document.getElementById("text");
const vid = document.getElementById("video");
const splash = document.getElementById("splashAudio");
const chamber = document.getElementById("chamberAudio");

vid.src = "video.mp4";
splash.src = "splash.mp3";
chamber.src = "audio.mp3";

let w = 0, h = 0;
let noiseData;

let progress = 0;        // 0 = splash, 1 = chamber
let targetProgress = 0;
const transitionMs = 6000;
const traceFloor = 0.025;

let audioStarted = false;
let entered = false;
let lastFrame = performance.now();
let driftImpulse = 0;
let lastImpulse = 0;
let touchInfluence = 0;
let ambientDisturbUntil = 0;
let nextAmbientDisturbAt = 0;

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

async function startMediaIfNeeded() {
  if (audioStarted) return;
  audioStarted = true;

  splash.muted = false;
  chamber.muted = false;
  splash.volume = 0.0;
  chamber.volume = 0.0;

  try { await splash.play(); } catch (e) { console.error("splash play failed", e); }
  try {
    await chamber.play();
    try {
      if (chamber.readyState >= 1 && chamber.duration && isFinite(chamber.duration) && chamber.duration > 0) {
        chamber.currentTime = Math.random() * chamber.duration;
      }
    } catch (e) {}
  } catch (e) { console.error("chamber play failed", e); }

  splash.volume = 0.08;

  if (vid.paused) {
    try {
      if (vid.readyState >= 1 && vid.duration && isFinite(vid.duration) && vid.duration > 0) {
        vid.currentTime = Math.random() * vid.duration;
      }
    } catch (e) {}
    vid.playbackRate = 0.92;
    vid.play().catch(() => {});
  }
}

function beginPress(e) {
  if (entered) return;
  if (e && e.cancelable) e.preventDefault();
  targetProgress = 1;
  entered = true;
  startMediaIfNeeded();
}

function endPress(e) {}

document.addEventListener("contextmenu", e => e.preventDefault());
document.body.addEventListener("pointerdown", beginPress, { passive: false });
document.body.addEventListener("pointerup", endPress, { passive: false });
document.body.addEventListener("pointercancel", endPress, { passive: false });
document.body.addEventListener("pointerleave", endPress, { passive: false });
document.body.addEventListener("touchstart", beginPress, { passive: false });
document.body.addEventListener("touchend", endPress, { passive: false });
document.body.addEventListener("touchcancel", endPress, { passive: false });

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

function loop(now) {
  const T = now * 0.001;
  const dtMs = Math.max(1, now - lastFrame);
  lastFrame = now;

  if (now - lastImpulse > 2600 + Math.random() * 3200) {
    driftImpulse = (Math.random() - .5) * .42;
    lastImpulse = now;
  }
  driftImpulse *= .965;

  const step = dtMs / transitionMs;
  if (targetProgress > progress) {
    progress = Math.min(targetProgress, progress + step);
  } else if (targetProgress < progress) {
    progress = Math.max(targetProgress, progress - step);
  }

  if (targetProgress > 0) {
    touchInfluence = Math.min(1, touchInfluence + 0.02);
  } else {
    touchInfluence = Math.max(0, touchInfluence - 0.02);
  }

  const eased = 1 - Math.pow(1 - progress, 2.2);
  const visibleMix = Math.max(progress > 0 ? traceFloor : 0, eased);

  if (progress > 0.7 && now > nextAmbientDisturbAt && ambientDisturbUntil < now) {
    ambientDisturbUntil = now + 1000 + Math.random() * 700;
    nextAmbientDisturbAt = now + 20000 + Math.random() * 26000;
  }

  let intensity = 1.25 + eased * 4.2;
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    intensity += 0.9 * Math.max(0.2, left);
  }

  drawField(T);
  drawNoise(intensity);

  const dx = Math.sin(T * .19) * (.16 + touchInfluence * 0.12) + driftImpulse;
  const dy = Math.cos(T * .17) * (.22 + touchInfluence * 0.12) + driftImpulse * .42;
  const scaleY = 1 - eased * .05;
  const scaleX = 1 - eased * .01;
  const microWarp = Math.sin(T * 0.6) * 0.002 + Math.cos(T * 0.4) * 0.002;
  const textDx = dx * (1 - eased * .10);
  const textDy = dy * (1 - eased * .08);
  const baseOpacity = Math.max(0.04, 0.42 - eased * 0.38);
  const flicker = Math.sin(T * 1.7) * 0.015;

  t.style.transform = `translate(calc(-50% + ${textDx}px), calc(-50% + ${textDy}px)) scaleX(${scaleX}) scaleY(${scaleY}) skewX(${microWarp}deg)`;
  t.style.letterSpacing = `${0.028 - eased * 0.008}em`;
  t.style.opacity = `${Math.max(0.04, baseOpacity + flicker)}`;
  t.style.filter = `blur(${0.72 + eased * 0.32}px)`;

  let brightness = 1 - eased * 0.08;
  if (now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    brightness -= left * 0.035;
  }
  document.body.style.filter = `brightness(${brightness})`;

  if (!vid.paused || progress > 0.001) {
    const videoOpacity = 0.03 + visibleMix * 0.82 + Math.sin(T * 0.19) * 0.008;
    vid.style.opacity = Math.max(0, Math.min(0.86, videoOpacity)).toFixed(3);

    const videoBrightness = 0.89 + Math.sin(T * 0.12 + 0.8) * 0.018;
    const videoContrast = 1.10 + Math.sin(T * 0.09) * 0.02;
    vid.style.filter = `blur(${2.5 - visibleMix * 0.75}px) contrast(${videoContrast}) brightness(${videoBrightness}) saturate(.78)`;
  }

  if (audioStarted) {
    const splashVol = Math.max(0, splashTargetVolume * (0.62 - eased * 0.34));
    const chamberVol = Math.max(0.12, chamberTargetVolume * eased);
    splash.volume = Math.min(1, splashVol);
    chamber.volume = Math.min(1, chamberVol);
  }

  requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);
