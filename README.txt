YOU FOUND NOTHING — V44

What this rebuild does:
- landing screen is clearly visible, gritty, stacked, moving text
- amorphous blob visible immediately
- first press only wakes splash audio + wakes the visuals up
- second press begins transition to first chamber
- splash and chamber audio crossfade during the chamber transition
- first chamber overlays artist/song text: Traffic Court .. 33310
- video and chamber audio loop

Root files expected beside index.html:
- splash.mp3
- audio.mp3
- video.mp4


V45 changes:
- fixes accidental first-tap chamber entry caused by duplicate mobile tap events
- now uses pointerdown only with debounce
- first press only wakes splash visuals/audio
- second press begins chamber transition and chamber audio


V46 changes:
- stages now advance only on completed press/release cycles
- first completed press wakes splash only
- second completed press begins chamber transition
- chamber audio is primed on first press and faded in on second


V46 changes:
- stages now advance only on completed press/release cycles
- first completed press wakes splash only
- second completed press begins chamber transition
- chamber audio is primed on first press and faded in on second


V47 changes:
- chamber audio no longer starts on first press; it only starts on the second completed press
- first completed press starts only splash audio and wake visuals
- second completed press starts chamber audio/video and transition


V48 changes:
- added a hard cooldown between first and second completed presses
- one quick tap can no longer be interpreted as both wake + chamber
- first completed press still starts only splash audio
- second completed press starts chamber transition/audio/video


V49 changes:
- holding now previews audio as well as visuals
- first hold previews splash audio before first completed press
- second hold previews chamber subtly before second completed press
- completed presses still control stage changes
