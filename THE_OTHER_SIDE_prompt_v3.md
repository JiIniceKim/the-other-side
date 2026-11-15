# THE OTHER SIDE — Build Prompt v3 (aligned to 2026 Design-A-Thon: PANOPTICON)

> **Tagline:** Everyone has an opinion. Until they're the one being watched.

## 0. Brief (read first)

**Theme:** The web is a surveillance state: we watch others' creations, and they watch us. *How does design respond to and influence mass perception?*
**Challenge:** *Design an experience that influences or disrupts how we currently connect with one another.*

**Problem we solve (state this explicitly in the UI and deck):**
Comment sections turn a complicated life into a 10-second clip and a one-line verdict. Viewers judge without context. The person being judged has no way to show what the viewer couldn't see. This *context collapse* makes online connection crueler and shallower.

**Our intervention (the "disrupt connection" moment):**
The visitor likes a judgmental comment → lives the life behind the post → sees their own choices judged out of context → returns to the feed and **chooses whether to keep, delete, or rewrite their comment**. The rewritten comment is posted back into the feed. That is the behavior change we want: *pause → get context → then respond.*

**Mass Perception stance (for deck slide 06):**
- **Critique:** the instant-verdict comment culture and engagement metrics that reward it.
- **Celebrate:** visibility that builds understanding — being seen *fully*, not partially.
- **Complicate:** the visitor is both watcher and watched. Their own "like" is part of the panopticon.

## 1. Judging criteria → design requirements

| Criterion (weight) | What the build must show |
|---|---|
| Visual & UI Design (25%) | Two distinct visual languages (cold feed → warm room → clinical glass exhibit). Strong hierarchy; one focal point per screen. Polished motion. |
| Problem Solving & UX (25%) | Explicit problem (context collapse). Zero-tutorial flow. Every step has **one clear action**. Ends with a concrete user action (rewrite comment). |
| Story & Communication (20%) | 3-act arc readable in a 2–3 min demo: Watch → Live → Be Watched → Reconnect. |
| Innovation & Creativity (20%) | The twist: liking a comment *is* the entry ticket, and the comment you liked becomes the comment aimed at you. |
| Presentation & Execution (10%) | No dead links, no placeholder text, no broken states. Consistent copy. |

## 2. Microcopy rule (most important UX constraint)

**Minimal text. The interface explains itself through visuals, motion, and affordance.**
- Max **6 words** of instructional text per screen. Max **12 words** of story text per beat.
- Never use paragraphs. Never use "Next" buttons when an object/gesture can advance.
- Use icons + numbers for resources (🕒 time, $ money, ⚡ energy, 🎓 grade). No labels needed after first hover.
- Affordance over instruction: glowing/pulsing hotspots, cursor change, hover lift, a single pulsing target when idle > 6s (the hint system).
- Choices are 2–3 short verbs: "Take shift" / "Study" / "Ask to swap".
- Reveal and reflection lines are the only "big type" moments — let them breathe.

## 3. Flow (each step = one screen, one action)

| # | Screen | On-screen text (exact, minimal) | User action | Visual language |
|---|---|---|---|---|
| 1 | **Feed** — story card: blurred student video still, metrics (2.1M ♥, 18.4K 💬) | Caption: "dropped out at 20 lol" | Tap 💬 | Clean, familiar social feed, cold white/blue |
| 2 | **Comment drawer** — 4 comments with like counts | Coach mark (first time only): "♥ a comment" | ♥ one comment | Same |
| 3 | **Transition** — liked comment enlarges, feed tilts away, eye-iris closes | "Now it's you." | auto (skippable, 2s) | Black → warm |
| 4 | **Room** — first-person illustrated dorm, 2.5D parallax on mouse/gyro. 5 glowing hotspots: phone, laptop, bills, calendar, door | None. Hover label only: "Phone", "Bills"… HUD icons appear | Explore / tap hotspots | Warm, intimate, lamp light |
| 5 | **Beat 1 — Phone buzzes** | "Boss: cover tonight? +$90" | Take shift · Study · Ask to swap | Warm |
| 6 | **Socratic prompt** (after each beat, 1 line) | e.g., "What haven't you checked?" | Tap → a hotspot glows (reveals hidden info, e.g., tutoring email) | Warm, faint camera dot appears in corner |
| 7 | **Beat 2 — Rent** | "Rent $640 · due Fri" | Call mom · Extra shifts · Financial aid office | Silhouettes appear in the window |
| 8 | **Beat 3 — Advisor email** | "Academic probation." | Stay enrolled · Take a leave | Walls start turning to glass; a comment counter ticks up |
| 9 | **Watched** — room becomes a glass exhibit; audience silhouettes; your choices become headlines | e.g., "STUDENT SKIPS EXAM" / "ASKS MOM FOR MONEY" + 3 floating comments | auto, then tap anywhere | Cold, clinical, surveillance grid |
| 10 | **Reveal** — the original post slides in; *your liked comment* is now under *your* story | "This was you." → "You were living the story you thought you understood." | Tap | Spotlight |
| 11 | **Reconnect** — your comment shown | "Still agree?" | Keep · Delete · Rewrite | Neutral, soft |
| 12 | **Rewrite** — text field pre-filled with your comment | "What would you say now?" | Type → Post | Neutral |
| 13 | **Back to feed** — your new comment appears pinned with a "seen the other side" badge | "Everyone is more than the moment you saw." | Next story | Feed returns, warmer tint |

Choices must change state: HUD values, which hotspots unlock, and which headlines/comments appear in steps 9–10. No single "correct" path.

**Different liked comment → different framing.** Each comment maps to an assumption the room challenges:
- "Just get another job." → the job board on the laptop shows every opening conflicts with class hours.
- "Should've studied harder." → the calendar shows 31 work hours this week.
- "Wasting an opportunity." → the bills show the scholarship was cut.
- "Why didn't they ask for help?" → the financial aid office is closed until Monday.
In step 10, the room's counter-evidence for *that* comment is highlighted.

## 4. Visual system
- **Feed:** off-white `#F4F3EF`, ink `#0E0F12`, accent heart red `#FF3B5C`. Rounded cards, Inter/SF.
- **Room:** warm amber `#F2B36B`, deep plum `#2A1E2E`, soft grain. Illustrated low-poly / flat-shaded look.
- **Watched:** desaturated blue `#9FB3C8`, black `#07080A`, signal orange `#FF5A1F` (matches the PANOPTICON brand's orange dots). Monospace headlines, scanlines, crosshair markers.
- Motion: 300–600ms ease-out for UI; 1.5–2.5s for perspective shifts. All transitions skippable (tap/Esc). Respect `prefers-reduced-motion` (crossfade instead).

## 5. Usability & accessibility
- One primary action per screen; secondary is visually quieter.
- Keyboard: Tab/Enter on every hotspot and choice; visible focus rings.
- Contrast ≥ 4.5:1 for all text; minimum 16px body, 14px labels.
- Hotspots have text labels for screen readers; no info conveyed by color alone.
- Persistent top bar: ← Feed, progress dots (Watch · Live · Watched · Reflect), pause/skip.
- Content note on entry (one line, dismissible): "A story about money and school stress."
- Works at 375px wide: room becomes swipe-to-pan; hotspots get larger hit areas (≥ 44px).

## 6. Platform note
- **Framer build (hackathon demo):** use the flow above as pages/variants with Framer interactions (hover, tap, appear, scroll, page transitions). Room = layered illustration with parallax; resources via component variants. Store the liked comment in a variable/code override to personalize steps 9–12.
- **Full 3D (stretch / post-hackathon):** React + R3F first-person room with WASD, pointer lock, E to interact — same story data and same microcopy rules.

## 7. Done when
A judge can, without reading instructions: open the feed → open comments → like a comment → explore the room → make 3 choices → watch the room become a glass exhibit → see their liked comment aimed at them → rewrite it → see it posted in the feed. Under 3 minutes.
