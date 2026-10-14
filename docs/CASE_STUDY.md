# StickSlap — prototype breakdown

## Design question

Can choosing enemies also become a movement system? The player has no walking
input. Selecting two or more targets defines both the next attack and the escape
destination. A heavy bomb pulls that destination toward itself, creating a useful
risk/reward choice.

## The interaction

1. Tap a target to attach one of five tentacles. Tap again to detach it.
2. Check the cyan marker and dotted line: they preview the committed dash.
3. Compress. Targets accelerate toward their mass-weighted center, and the player
   dashes toward that same point with brief protection.
4. Fast collisions damage enemies. Bombs can turn one compression into a chain
   reaction. Chained kills fill an ability meter.

The safe practice round isolates steps 1–3 with stationary targets, no spawning
and protected health. It ends after the first successful two-target compression.

## Where the rules live

`simulation.js` runs independently of the page. `compressionCenter()` calculates

```text
center.x = sum(target.x × target.mass) / sum(target.mass)
center.y = sum(target.y × target.mass) / sum(target.mass)
```

The player is excluded from this average. `compress()` commits the center,
sets target velocities, grants brief invulnerability and releases selections.
`tick(dt)` advances movement, contacts, spawn timers and scoring. The browser
accumulates elapsed time and advances rules in 1/240-second steps, with bounded
frame catch-up.

`game.js` connects pointer input, menu states, Canvas drawing, HUD and Web Audio.
It owns practice and pause behavior; the engine owns combat rules. Resizing
changes the playable arena bounds and clamps bodies into those bounds.

## Feedback and access

The destination is visible before committing. Grab rings, collision particles,
short tones and contextual notices make state changes readable. A calm-motion
setting removes screen shake and reduces pulsing; it respects the operating
system's reduced-motion preference on first use. Sound starts on. Leaving the
tab or window pauses the run, and buttons support native keyboard activation.

## Music and gameplay

The game plays the creator-provided **Trails of Light** MP3 and its matching
energy/beat map. Sound is enabled on every page load and playback starts with
the run or practice interaction. Beat timing continues when muted, so the sound
setting does not change the gameplay difficulty. Pause also pauses the music.

`tools/generate-music.cjs` retains the earlier 128 BPM synthesized score as an
alternative and writes its map separately, leaving the active song's map intact.

## Validation and tradeoffs

Run `node tests.cjs`. The checks exercise actual engine behavior: weighted
destinations, attach/detach, collisions, bomb chains, contact damage, abilities,
critical-health pickups, reset, sustained play and generated audio.

The presentation uses Canvas 2D and locally generated assets. This keeps startup
small and avoids a framework/build dependency. Circular collision bodies and
bounded gameplay forces are deliberate arcade approximations. A browser check
is separate from the simulation checks; real phone hardware still needs testing.

## Development attribution

This is an AI-assisted prototype. The creator supplied the concept, creative
direction and iteration requests; implementation, porting, polish and verification
used substantial AI assistance. The source and this breakdown make the work
inspectable. Understanding and modifying the implementation is an ongoing part
of the learning process.

## A five-minute code walkthrough

Read `compressionCenter`, `compress`, `damage` and `tick`, in that order. Then
follow the pointer listener and `feedback` in `game.js`. Explain why a heavier
target changes the dash destination and why the same bomb must not score twice.
Try changing one target's mass in a local engine test before changing gameplay.

Future work: physical phone playtests, more input options for canvas targeting,
additional difficulty tuning and a broader selection of original music.
