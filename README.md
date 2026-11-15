# THE OTHER SIDE

> Everyone has an opinion. Until they're the one being watched.

An interactive story for the **2026 Design at UT Design-A-Thon — PANOPTICON**.
A visitor judges a stranger's viral post, lives that stranger's week, watches their own choices get judged out of context, and finally decides what to say instead.

## Flow

| Act | What happens |
|---|---|
| Intro | A dark apartment block at night. Click → one window lights up (phone glow) → a notification arrives. |
| Feed | A social post: "dropped out at 20 lol". Open comments → **like the one comment you agree with**. |
| Transition | Zoom out → another window turns warm → first-person: the student reads the same post and comments, puts the phone down. *"You don't even know me. …and you've already decided."* |
| Room | Explore the student's room (phone, computer, bills, calendar, door). Three decisions: work vs. study, rent, stay vs. leave. After each, a stranger's take flashes on the window. |
| Watched | The building lights up, screen by screen, all watching one warm window. Headlines + comments. The last window to light up is yours: *"One of those likes was yours."* |
| Reveal | "YOU WERE BOTH." What you saw vs. what they saw. |
| Reflect | "Still agree?" → keep or rewrite your comment (is it true? kind? necessary?). |
| Epilogue | Your comment reaches the student's phone. If rewritten, both windows turn warm. |

## Repo structure

```
framer/TheOtherSide.tsx      # The whole experience as one Framer code component
THE_OTHER_SIDE_prompt_v3.md  # Design brief / build prompt aligned to the judging criteria
```

## Working on it

The live prototype is a **Framer code component** (`TheOtherSide`) placed full-screen on the Home page of the Framer project.

1. Edit `framer/TheOtherSide.tsx` (React + TypeScript; only `react`, `framer`, `framer-motion` imports are allowed).
2. In Framer, open the code file **TheOtherSide.tsx** in the Assets panel and paste the new contents (or ask Claude to sync it).
3. Commit and push here so everyone stays on the same version.

Tip: the component has a **Start at** property (Intro / Feed / Phone POV / Room) for previewing a scene on the canvas. Keep it on **Intro** for the published site.

## Design notes

- **Blue is a highlight only**: screen light, the primary action, the liked comment, alerts. Everything else is dusk slate (outside) or warm lamp light (inside).
- Minimal text per step: affordances (glowing hotspots, one primary action per screen) instead of instructions.
- Accessibility: keyboard focus on every hotspot and choice, `prefers-reduced-motion` support, skippable transitions, a way back to the feed at every step.

## Award-focused interaction notes

- The loader is skippable and has a fail-safe exit so atmosphere never blocks the experience.
- The feed asks visitors to choose one comment as their starting lens before the story begins.
- The room turns private constraints into readable decisions, then the watched phase separates supportive, critical, and uncertain voices.
- The visual language uses blue for surveillance and warm amber for human context; phase labels in the top bar keep the journey oriented.
