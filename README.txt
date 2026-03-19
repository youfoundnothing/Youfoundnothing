YOU FOUND NOTHING. — V23

This version shifts the second chamber away from "something activated"
and toward "you realized you were already inside something."

What changed:
- the chamber begins to leak in BEFORE full arrival
- splash and chamber overlap more messily
- video appears as a trace before the threshold, not a clean reveal
- text starts losing itself before full arrival
- transition is less readable as cause/effect

Root-level GitHub Pages files:
index.html
styles.css
script.js
video.mp4
splash.mp3
audio.mp3


V24 changes:
- chamber fade-in is longer and more gradual
- chamber now fades back out when you release after entering
- exit dissolves instead of cutting abruptly


V25 changes:
- overall visibility raised about 10%
- chamber audio fade-in is now truly gradual across the full 9 seconds
- chamber audio fade-out now also dissolves gradually across 9 seconds
- video presence now fades in/out more gradually to match the audio


V26 changes:
- chamber fade now uses a smooth mix value instead of abrupt state math
- pre-arrival chamber/audio traces are much lower so the full arrival reads less like a jump
- video fade follows the same smoother chamber mix


V27 changes:
- audio now uses Web Audio API gain nodes for true smooth fades on iPhone/Safari
- chamber fade in/out is controlled by audio engine instead of HTMLAudio volume
- visual chamber mix remains aligned with audio emergence/recession


V28 changes:
- simplified to an on/off switch model
- press anywhere = 9 second fade up
- release anywhere = 9 second fade down
- fades are fully reversible from whatever point they are at
- video and audio both follow the same single progress value
- chamber can be entered and left repeatedly without one-time state issues
