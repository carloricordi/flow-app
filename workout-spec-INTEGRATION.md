# Good Morning Flow — Workout Spec Integration

The Good Morning flow currently shows the workout for today as a single label (e.g., "Interval Run"). Replace that with a rendered card sourced from `workout-spec.json`.

## What changes

Today the flow looks roughly like:

> Today's workout: **Interval Run**

After integration it should look more like:

> **Tuesday — Interval Run**
> 5 x 3 min hard / 2 min easy jog · 40–45 min total
>
> **Warmup** — 1 mile easy (~10 min, 11:00–11:30/mi)
> **Intervals** — 5 rounds:
>   ▸ Work: 3 min @ 7:45–8:30/mi (8/10 effort, 3–4 words max)
>   ▸ Rest: 2 min @ 12:00–13:00/mi (embarrassingly slow jog)
> **Cooldown** — 5–10 min walk/jog until HR settles
>
> _Don't sprint. 8/10 effort is the target. Pace honestly so round 5 holds up._

## How to wire it

The spec is now date-aware. Resolution order on each render:

1. Load `workout-spec.json` once on app boot.
2. Take today's date in `YYYY-MM-DD` format and look it up in `schedule`.
3. If found:
   - Read `templateRef` → load `templates[templateRef]` as the base workout.
   - Overlay any per-date overrides from the schedule entry (e.g., `distance`, `pace`, `label`).
4. If not found (out of block, or a non-running day with no override):
   - Fall back to `dayDefaults[<dayOfWeek>]` → load `templates[templateRef]`.
5. Render the resolved workout:
   - `displayName` → card title (use the schedule entry's `label` as a kicker above it, e.g. "Interval Tuesday — wk 3")
   - `summary` → subtitle
   - `totalDuration` → time pill / chip
   - `segments[]` → render each phase as a row:
     - `phase` (warmup, intervals, main, cooldown, etc.) becomes the row label
     - For `run-intervals` templates, `work` and `rest` are nested objects inside the `intervals` segment — render them as two sub-rows under "Intervals"
     - Show `duration`, `pace`, `effort`, and `cue` when present
   - `coachingCue` → italicized footer line
   - For long runs (or any run where resolved `distance` ≥ 10 mi), surface `fuelingReminder` as a pinned banner above the card
6. Sunday/rest cards should feel different — no prescription, just permission to rest. Render `optional.options[]` as a casual list.

## Block structure (May 5 – Jun 30, 2026)

The current 9-week block is in `schedule`. Highlights:

- **Tuesdays alternate** intervals (May 5, 19, Jun 2, 16, 30) and tempo (May 12, 26, Jun 9, 23).
- **Interval ladder**: 5x3/2 → 6x3/90 → 6x4/90 → 7x4/90 → 8x4/90.
- **Tempo ladder**: 4mi @ 9:00 → 4.5mi @ 8:50 → 5mi @ 8:45 → 5mi @ 8:40.
- **Friday easy runs** progress 3 → 5 mi over 8 weeks (Z2 only, 10:30–11:30/mi).
- **Saturday long runs** climb 10 → 14 mi by end of June. Gel every 45 min from mile 3 is mandatory on every one.

## Editing later

The spec is intentionally flat JSON so Carlo can:
- Update interval paces as PRs come in (edit `work.pace`, `rest.pace`)
- Bump long-run distance week over week (currently set as "varies")
- Swap the strength menu without touching app code

## Linking back to memory

The values in `athleteProfile` and `effortScale` in the JSON should track the memory entries:
- `running_benchmarks.md` → `athleteProfile`
- `feedback_specificity.md` → the requirement that the app *render* full structure rather than just the workout name

When Carlo PRs or shifts targets, update both the memory file and the JSON together so the on-the-go coach (mobile chat) and the app stay in sync.

## Suggested next iteration

- Add a `recoveryProtocol` block that the app surfaces post-workout (gel timing log for long runs, hip/core stretches after intervals).
- Add a `progressLog` array the app appends to each time Carlo completes a workout (date, actual paces, RPE, notes). That becomes the data we revisit in weekly check-ins.
- Add a `marathonCountdown` field driven off the Miami Marathon date so the home screen shows days remaining.
