const bg = document.getElementById("bg");
const bctx = bg.getContext("2d");
const noise = document.getElementById("noise");
const nctx = noise.getContext("2d");
const t = document.getElementById("text");
const vid = document.getElementById("video");
const aud = document.getElementById("audio");

vid.src = "video.mp4";
aud.src = "audio.mp3";

let w, h;
let holdStart = null;
let holding = false;
let entered = false;
let noiseData;
let driftImpulse = 0;
let lastImpulse = 0;
let entryDisturbUntil = 0;
let ambientDisturbUntil = 0;
let nextAmbientDisturbAt = 0;
let audioFadeStart = null;
let audioFadeTarget = 0.58;

function resize() {
  w = innerWidth;
  h = innerHeight;
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

function beginEntry(now) {
  entered = true;
  document.body.classList.add("entered");
  entryDisturbUntil = now + 1800;
  audioFadeStart = now;

  const startVideo = () => {
    vid.playbackRate = 0.92;
    vid.play().catch(() => {});
  };

  if (vid.readyState >= 1) {
    try {
      if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
        vid.currentTime = Math.random() * vid.duration;
      }
    } catch (e) {}
    startVideo();
  } else {
    vid.addEventListener("loadedmetadata", () => {
      try {
        if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
          vid.currentTime = Math.random() * vid.duration;
        }
      } catch (e) {}
      startVideo();
    }, { once: true });
    startVideo();
  }

  if (aud.readyState >= 1) {
    try {
      if (aud.duration && isFinite(aud.duration) && aud.duration > 0) {
        aud.currentTime = Math.random() * aud.duration;
      }
    } catch (e) {}
  } else {
    aud.addEventListener("loadedmetadata", () => {
      try {
        if (aud.duration && isFinite(aud.duration) && aud.duration > 0) {
          aud.currentTime = Math.random() * aud.duration;
        }
      } catch (e) {}
    }, { once: true });
  }

  aud.volume = 0;
  aud.play().catch(() => {});

  nextAmbientDisturbAt = now + 18000 + Math.random() * 22000;
}

function startHold(e) {
  e.preventDefault();
  if (entered) return;
  holding = true;
  holdStart = performance.now();
  aud.play().catch(() => {});
}

function endHold(e) {
  if (e) e.preventDefault();
  if (entered) return;
  holding = false;
  holdStart = null;
}

document.addEventListener("contextmenu", e => e.preventDefault());
document.body.addEventListener("mousedown", startHold);
document.body.addEventListener("mouseup", endHold);
document.body.addEventListener("mouseleave", endHold);
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
  const progress = Math.pow(raw, 2.2);

  if (!entered && progress > 0.95) {
    beginEntry(now);
  }

  if (entered && now > nextAmbientDisturbAt && ambientDisturbUntil < now) {
    ambientDisturbUntil = now + 1000 + Math.random() * 700;
    nextAmbientDisturbAt = now + 20000 + Math.random() * 26000;
  }

  let intensity = 1.25 + progress * 5.4;
  if (entered) intensity = 1.55;

  if (now < entryDisturbUntil) {
    const left = (entryDisturbUntil - now) / 1800;
    intensity += left * 4.2;
  }

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

  t.style.transform = `
translate(calc(-50% + ${textDx}px), calc(-50% + ${textDy}px))
scaleX(${scaleX})
scaleY(${scaleY})
`;
  t.style.letterSpacing = `${0.028 - progress * 0.008 + (Math.random() - 0.5) * 0.002}em`;
  t.style.opacity = `${0.42 + progress * 0.2}`;
  t.style.filter = `blur(${0.72 - progress * 0.28}px)`;

  let brightness = 1 - progress * 0.13;
  if (entered && now < entryDisturbUntil) {
    const left = (entryDisturbUntil - now) / 1800;
    brightness -= left * 0.08;
  } else if (entered && now < ambientDisturbUntil) {
    const left = (ambientDisturbUntil - now) / 1700;
    brightness -= left * 0.035;
  }
  document.body.style.filter = `brightness(${brightness})`;

  if (entered) {
    const videoOpacity = 0.82 + Math.sin(T * 0.19) * 0.018;
    vid.style.opacity = videoOpacity.toFixed(3);

    const videoBrightness = 0.88 + Math.sin(T * 0.12 + 0.8) * 0.02;
    const videoContrast = 1.10 + Math.sin(T * 0.09) * 0.02;
    vid.style.filter = `blur(2px) contrast(${videoContrast}) brightness(${videoBrightness}) saturate(.82)`;

    if (audioFadeStart !== null) {
      const fadeT = Math.min(1, (now - audioFadeStart) / 4200);
      const eased = 1 - Math.pow(1 - fadeT, 2);
      const wobble = Math.sin(T * 0.37) * 0.01;
      aud.volume = Math.max(0, Math.min(audioFadeTarget, eased * audioFadeTarget + wobble));
      if (fadeT >= 1) {
        audioFadeStart = null;
      }
    } else {
      const ambientWobble = Math.sin(T * 0.31) * 0.008;
      aud.volume = Math.max(0.48, Math.min(audioFadeTarget + 0.02, audioFadeTarget + ambientWobble));
    }
  }

  requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);
