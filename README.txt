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


V29 changes:
- audio startup is now awaited inside the press gesture for iPhone reliability
- splash + chamber are both explicitly unlocked during the first press
- audio uses AudioParam smoothing instead of direct gain.value writes
- preload enabled on splash/chamber/video


V31 changes:
- reverted to simpler direct HTML audio playback so sound should be audible again
- keeps the v28 on/off-switch behavior
- includes homepage refinement pass: more visibility, living text, subtle touch gravity


V32 changes:
- transition progression changed from 9 seconds to 3 seconds


V34 changes:
- transition increased to 6 seconds
- chamber audio floor raised so first chamber is definitely audible
- splash reduced slightly so chamber can come through more clearly
- chamber playback startup order simplified for better reliability


V37 changes:
- rolled back the startup change that seemed to kill chamber audio on your phone
- kept the 9-second transition
- uses a gentler crossfade curve so chamber emerges more gradually without disappearing entirely


V38 changes:
- audio now unlocks on completed tap instead of while holding
- tap commits you into the first chamber; no release-to-home behavior
- chamber audio starts muted and fades up later/more gradually during the transition
- splash and chamber now crossfade with staggered curves so chamber should not hit immediately


V39 changes:
- increased midtone visibility for mobile
- slightly reduced blur, increased contrast/brightness
- boosted noise layer for perceptibility
- improved text legibility while keeping subdued tone


V41 changes:
- audio unlock now retries on both press and release
- mediaUnlocked is only set after playback actually starts
- fixes the case where hold failed because unlock was marked before audio really started
