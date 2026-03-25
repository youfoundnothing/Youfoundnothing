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
