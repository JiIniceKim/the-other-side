import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useCallback,
    useId,
    memo,
    startTransition,
    type CSSProperties,
    type ReactNode,
    type RefObject,
    type PointerEvent as RPointerEvent,
} from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

/* ───────────────────────── Palette (blue = highlight only) ───────────────────────── */

const BLUE = "#3346FF"
const BLUE_GLOW = "#6E7BFF"
const PAPER = "#EDE7DC"
const INK = "#0C0D11"
const NIGHT = "#10131A"
const AMBER = "#FFB867"
const TEXT = "#F3EDE4"

/* ───────────────────────── Story data ───────────────────────── */

type ObjId = "phone" | "laptop" | "bills" | "calendar" | "door"
type Stats = { money: number; energy: number; grade: number }
type Phase = "profile" | "intro" | "feed" | "transit" | "room" | "watched" | "toStudent" | "yourpost" | "toViewer" | "notify" | "yourmove" | "ending"

interface Comment {
    id: string
    handle: string
    text: string
    likes: number
    evidence: ObjId
}

const COMMENTS: Comment[] = [
    { id: "c1", handle: "grindset.mike", text: "I would’ve just gotten another job.", likes: 4213, evidence: "laptop" },
    { id: "c2", handle: "4.0_or_bust", text: "Why didn’t they just study harder?", likes: 3108, evidence: "calendar" },
    { id: "c3", handle: "lena.k", text: "Imagine wasting an opportunity like that.", likes: 2741, evidence: "bills" },
    { id: "c4", handle: "justsaying_", text: "Why didn’t they ask for help??", likes: 1906, evidence: "door" },
]

const OBJECTS: Record<ObjId, { label: string; info: string; seen: string; x: number; y: number }> = {
    phone: { label: "Phone", info: "Mom: “Proud of you. Don’t worry about us.”", seen: "Mom is struggling too.", x: 55.3, y: 60.6 },
    laptop: { label: "Computer", info: "Job board: every opening overlaps class.", seen: "No job fits class hours.", x: 67.5, y: 51 },
    bills: { label: "Bills", info: "Scholarship cut: −$2,400.", seen: "The scholarship was cut.", x: 78.4, y: 60.6 },
    calendar: { label: "Calendar", info: "31 work hours this week. Exam Fri 9 AM.", seen: "31 work hours a week.", x: 42.5, y: 28.5 },
    door: { label: "Door", info: "Aid office: closed until Monday.", seen: "Help was closed till Monday.", x: 93.6, y: 52 },
}

interface Option {
    id: string
    outside: string
    label: string
    d: Partial<Stats>
    out: string
    head: string
}
interface Beat {
    obj: ObjId
    prompt: (s: Stats) => string
    options: Option[]
}

const BEATS: Beat[] = [
    {
        obj: "phone",
        prompt: () => "Boss: “Can you cover tonight? +$90”",
        options: [
            { id: "shift", outside: "skipping exams again lol", label: "Take shift", d: { money: 90, energy: -30, grade: -15 }, out: "Rent closer. Notes untouched.", head: "SKIPS STUDYING FOR EXAM" },
            { id: "study", outside: "must be nice to not need a job", label: "Study", d: { energy: -10, grade: 12 }, out: "Ready for the exam. Rent isn’t.", head: "TURNS DOWN WORK. AGAIN." },
            { id: "swap", outside: "flaky coworker energy", label: "Ask to swap", d: { money: 45, energy: -20, grade: 4 }, out: "Half a shift. Half ready.", head: "LEAVES COWORKERS SHORT" },
        ],
    },
    {
        obj: "bills",
        prompt: () => "Rent $640 · due Friday",
        options: [
            { id: "mom", outside: "parents paying for everything 🙄", label: "Call Mom", d: { money: 150, energy: -5 }, out: "She sent it. Her rent is late now.", head: "STILL ASKS PARENTS FOR MONEY" },
            { id: "shifts", outside: "so school was never the priority", label: "Pick up shifts", d: { money: 240, energy: -35, grade: -15 }, out: "Rent paid. Missed two lectures.", head: "PUTS JOB BEFORE SCHOOL" },
            { id: "aid", outside: "can’t even pay rent on time", label: "Financial aid", d: { money: 255, energy: -10 }, out: "Grant approved — Monday. Late fee $45.", head: "PAYS RENT LATE" },
        ],
    },
    {
        obj: "laptop",
        prompt: (s) => (s.grade < 60 ? "Advisor: “You’re on academic probation.”" : "Advisor: “One more bad week = probation.”"),
        options: [
            { id: "stay", outside: "just accept it’s not for you", label: "Stay enrolled", d: { energy: -15, grade: 5 }, out: "Next semester. Same math.", head: "WON’T ADMIT IT’S NOT WORKING" },
            { id: "leave", outside: "knew they’d quit", label: "Take a leave", d: { energy: 20 }, out: "A pause, not a quit. No one will see that.", head: "DROPS OUT AT 20" },
        ],
    },
]

const CLOCK = ["THU 6:40 PM", "FRI 1:15 AM", "FRI 8:30 AM", "MON 9:00 AM"]
const SOCRATIC = ["What haven’t you checked?", "Who else does this touch?"]
const START: Stats = { money: 180, energy: 70, grade: 72 }
const CROWD = [
    { h: "anon_88", t: "couldn’t be me" },
    { h: "kyle.w", t: "skill issue" },
    { h: "mira", t: "no excuses" },
    { h: "user4471", t: "main character syndrome" },
    { h: "jules", t: "ngl that’s on them" },
    { h: "dev", t: "lol" },
]

const PHONE_POPS: { who: "mom" | "sns" | "boss"; t: string }[] = [
    { who: "mom", t: "Mom: I’m so proud of you ❤️" },
    { who: "sns", t: "@anon_88: couldn’t be me" },
    { who: "sns", t: "@4.0_or_bust: why not just study harder?" },
    { who: "mom", t: "Mom: Don’t worry about us, okay?" },
    { who: "sns", t: "@kyle.w: skill issue" },
    { who: "boss", t: "Boss: Can you cover tonight? +$90" },
]

const EVIDENCE_THOUGHT: Record<ObjId, string> = {
    calendar: "How many hours did I work this week?",
    laptop: "Is there any job that fits around my classes?",
    door: "Maybe the aid office can help…",
    bills: "How bad is it, really?",
    phone: "",
}

const POV_STREAM = [
    { h: "grindset.mike", t: "I would’ve just gotten another job.", n: 4213 },
    { h: "anon_88", t: "couldn’t be me", n: 1204 },
    { h: "4.0_or_bust", t: "Why didn’t they just study harder?", n: 3108 },
    { h: "sam.r", t: "college isn’t for everyone tbh", n: 812 },
    { h: "lena.k", t: "Imagine wasting an opportunity like that.", n: 2741 },
    { h: "kyle.w", t: "skill issue", n: 960 },
    { h: "noor", t: "we don’t know their situation…", n: 88 },
    { h: "justsaying_", t: "Why didn’t they ask for help??", n: 1906 },
    { h: "mira", t: "no excuses", n: 703 },
    { h: "user4471", t: "main character syndrome", n: 511 },
    { h: "dev", t: "lol", n: 342 },
    { h: "jules", t: "ngl that’s on them", n: 655 },
]

/* ───────────────────────── Utils ───────────────────────── */

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

function hash(i: number, j: number, s: number) {
    const x = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453
    return x - Math.floor(x)
}
function fmt(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K"
    return String(n)
}
function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n))
}
function safeGet(key: string): string | null {
    try {
        if (typeof window === "undefined") return null
        return window.localStorage.getItem(key)
    } catch {
        return null
    }
}
function safeSet(key: string, v: string) {
    try {
        if (typeof window !== "undefined") window.localStorage.setItem(key, v)
    } catch {}
}
function ding() {
    try {
        if (typeof window === "undefined") return
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext
        if (!AC) return
        const ctx = new AC()
        const t = ctx.currentTime
        ;[880, 1318].forEach((f, i) => {
            const o = ctx.createOscillator()
            const g = ctx.createGain()
            o.type = "sine"
            o.frequency.value = f
            const s = t + i * 0.12
            g.gain.setValueAtTime(0.0001, s)
            g.gain.exponentialRampToValueAtTime(0.16, s + 0.02)
            g.gain.exponentialRampToValueAtTime(0.0001, s + 0.5)
            o.connect(g)
            g.connect(ctx.destination)
            o.start(s)
            o.stop(s + 0.55)
        })
        window.setTimeout(() => ctx.close(), 1200)
    } catch {}
}

function useBox(ref: RefObject<HTMLElement>) {
    const [box, setBox] = useState({ w: 1200, h: 800, ok: false })
    useIsoLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        setBox({ w: el.clientWidth || 1200, h: el.clientHeight || 800, ok: true })
        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver((entries) => {
            const r = entries[0].contentRect
            setBox((b) => (Math.abs(b.w - r.width) < 1 && Math.abs(b.h - r.height) < 1 ? b : { w: r.width, h: r.height, ok: true }))
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    return box
}

const srOnly: CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`

/* ───────────────────────── Act 0 data: who are you ───────────────────────── */

type TeamChoice = "carried" | "reported" | "slid"
type CommentId = "c1" | "c2" | "c3" | "c4"
interface Profile {
    name: string
    team: TeamChoice
    comfort: string
}

const TEAM_OPTIONS: { id: TeamChoice; label: string }[] = [
    { id: "carried", label: "I’d just do their part too" },
    { id: "reported", label: "I’d tell the professor" },
    { id: "slid", label: "I’d let it slide" },
]
const COMFORTS = ["late-night ramen", "cat videos", "long walks", "old sitcoms", "iced coffee", "gaming till 2AM"]
const NAME_IDEAS = ["night.owl_27", "quiet.reader", "coffee.n.code", "sunday.walker", "pixel.person", "late.bloomer"]

/* how your answer gets cut out of context — a little unfair, never cruel */
const YOUR_CAPTION: Record<TeamChoice, string> = {
    carried: "didn’t trust the team to do anything 😬 #groupproject",
    reported: "went straight to the professor 👀 #groupproject",
    slid: "let one person skip all the work lol #groupproject",
}
/* same kind of comment you liked on the college post, now about you */
const YOUR_COMMENTS: Record<TeamChoice, Record<CommentId, string>> = {
    carried: { c1: "Just split the work evenly next time lol", c2: "Should’ve managed the team better", c3: "Sounds like a control thing tbh", c4: "Why not just ask the TA?" },
    reported: { c1: "Just talk to them first lol", c2: "Should’ve handled it yourself", c3: "Kinda dramatic tbh", c4: "Why not ask the TA instead?" },
    slid: { c1: "Just tell them to do their part lol", c2: "Should’ve pushed them harder", c3: "Letting people walk all over you huh", c4: "Why didn’t you tell the professor??" },
}
const YOUR_HANDLES: Record<CommentId, string> = { c1: "fixit.felix", c2: "deans.list.dana", c3: "honest.opinion", c4: "just.asking_" }
const YOUR_COUNTS: Record<CommentId, number> = { c1: 214, c2: 167, c3: 98, c4: 131 }

function loadProfile(): Profile | null {
    try {
        const raw = safeGet("tos.profile")
        if (!raw) return null
        const p = JSON.parse(raw)
        if (p && typeof p.name === "string" && TEAM_OPTIONS.some((o) => o.id === p.team) && typeof p.comfort === "string") return p
    } catch {}
    return null
}
const DEFAULT_PROFILE: Profile = { name: "night.owl_27", team: "reported", comfort: "late-night ramen" }

/* ───────────────────────── Bitmap marks ───────────────────────── */

function Bitmap(props: { map: string[]; size: number; color: string }) {
    const { map, size, color } = props
    const w = map[0].length
    const h = map.length
    return (
        <svg width={size} height={(size * h) / w} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" shapeRendering="crispEdges" style={{ display: "block" }}>
            {map.flatMap((r, i) => r.split("").map((ch, j) => (ch === "#" ? <rect key={`${i}-${j}`} x={j} y={i} width={1} height={1} fill={color} /> : null)))}
        </svg>
    )
}
const EYE = ["..#####..", ".#.....#.", "#...#...#", "#..###..#", "#...#...#", ".#.....#.", "..#####.."]

/* ───────────────────────── Pixel figure (reveal) ───────────────────────── */

const FIG = [
    "........###.........",
    ".......#####........",
    ".......######.......",
    ".......######.......",
    ".......#####........",
    "........###.........",
    "........###.........",
    ".....#########......",
    "....###########.....",
    "...#############....",
    "...##############...",
    "...##############...",
    "..###.#########.##..",
    "..###.#########.##..",
    "..###.#########.###.",
    "..##..#########..##.",
    "..##..#########..##.",
    "..##..#########..##.",
    ".###..#########..##.",
    ".##...#########..##.",
    ".##...#########...#.",
    "......#########.....",
    "......#########.....",
    "......####.####.....",
    "......####.####.....",
    "......###...###.....",
    "......###...###.....",
    "......###...###.....",
    "......###...###.....",
    "......###...###.....",
    "......###...###.....",
    "......###...###.....",
    "......###...###.....",
    "......###...###.....",
    ".....####...####....",
    ".....####...####....",
]
const CELL = 10
const CELLS = (() => {
    const out: { i: number; j: number }[] = []
    FIG.forEach((row, i) => {
        for (let j = 0; j < 20; j++) if (row[j] === "#") out.push({ i, j })
    })
    return out
})()

function wrapText(text: string, max: number) {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let cur = ""
    for (const w of words) {
        if ((cur + " " + w).trim().length > max) {
            if (cur) lines.push(cur)
            cur = w
        } else cur = (cur + " " + w).trim()
    }
    if (cur) lines.push(cur)
    return lines
}


/* ───────────────────────── Icons ───────────────────────── */

function Icon(props: { name: string; size?: number; fill?: boolean }) {
    const { name, size = 22, fill = false } = props
    const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true }
    switch (name) {
        case "heart":
            return (
                <svg {...p} fill={fill ? "currentColor" : "none"}>
                    <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
                </svg>
            )
        case "comment":
            return (
                <svg {...p}>
                    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
                </svg>
            )
        case "share":
            return (
                <svg {...p}>
                    <path d="M14 4l7 7-7 7M21 11H10a6 6 0 0 0-6 6v2" />
                </svg>
            )
        case "back":
            return (
                <svg {...p}>
                    <path d="M15 18l-6-6 6-6" />
                </svg>
            )
        case "next":
            return (
                <svg {...p}>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
            )
        case "x":
            return (
                <svg {...p}>
                    <path d="M18 6 6 18M6 6l12 12" />
                </svg>
            )
        case "replay":
            return (
                <svg {...p}>
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
                </svg>
            )
        case "send":
            return (
                <svg {...p}>
                    <path d="m22 2-7 20-4-9-9-4 20-7Z" />
                </svg>
            )
        case "lock":
            return (
                <svg {...p}>
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
            )
        case "skip":
            return (
                <svg {...p}>
                    <path d="M5 5l9 7-9 7V5ZM19 5v14" />
                </svg>
            )
        default:
            return null
    }
}

/* ───────────────────────── CSS ───────────────────────── */

const CSS = `
.tos{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;color:${TEXT};}
.tos *{box-sizing:border-box}
.tos button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
.tos button:focus-visible,.tos textarea:focus-visible{outline:3px solid ${BLUE_GLOW};outline-offset:3px}
.tos .px{font-family:VT323,ui-monospace,Menlo,monospace;letter-spacing:.03em}
.tos .serif{font-family:"Instrument Serif",Georgia,serif}
.tos .scroll{overflow-y:auto;overflow-x:hidden;scrollbar-width:none}
.tos .scroll::-webkit-scrollbar{display:none}
.tos .grain{position:absolute;inset:0;pointer-events:none;background-image:${GRAIN};opacity:.08;mix-blend-mode:overlay}
@keyframes tosGrain{0%{transform:translate(0,0)}25%{transform:translate(-3%,2%)}50%{transform:translate(2%,-3%)}75%{transform:translate(-2%,-1%)}100%{transform:translate(0,0)}}
.tos .vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 55% 45%,transparent 45%,rgba(0,0,0,.6) 100%)}
.tos .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:10px 20px;border-radius:10px;background:${BLUE};color:#fff;font-weight:700;font-size:15px;box-shadow:0 0 0 1px rgba(255,255,255,.1),0 8px 28px rgba(51,70,255,.45);transition:transform .15s,box-shadow .15s}
.tos .btn:hover{transform:translateY(-1px);box-shadow:0 0 0 1px rgba(255,255,255,.2),0 10px 34px rgba(51,70,255,.6)}
.tos .ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:10px 20px;border-radius:10px;border:1.5px solid rgba(243,237,228,.55);color:${TEXT};font-weight:600;font-size:15px;transition:background .15s,color .15s}
.tos .ghost:hover{background:${TEXT};color:${INK}}
.tos .ghost.ink{border-color:rgba(12,13,17,.5);color:${INK}}
.tos .ghost.ink:hover{background:${INK};color:${PAPER}}
.tos .glass{background:rgba(20,17,20,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,235,210,.14);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.tos .rail-btn{display:flex;flex-direction:column;align-items:center;gap:3px;color:#fff;font-size:12px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.tos .rail-btn .ic{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.35);backdrop-filter:blur(6px);transition:transform .15s}
.tos .rail-btn:hover .ic{transform:scale(1.08)}
.tos .cmt-heart{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:44px;min-height:44px;justify-content:center;color:#8d8f99;font-size:11px;font-weight:600}
.tos .cmt-heart:hover{color:${BLUE_GLOW}}
.tos .hot{position:absolute;width:58px;height:58px;display:grid;place-items:center}
.tos .hot .ring{position:absolute;inset:16px;border-radius:50%;border:1.5px solid rgba(255,240,220,.75);transition:inset .2s ease,border-color .2s}
.tos .hot .dot{width:7px;height:7px;border-radius:50%;background:rgba(255,240,220,.95);box-shadow:0 0 10px rgba(255,210,150,.9)}
.tos .hot.seen .ring{border-color:rgba(255,240,220,.28)}
.tos .hot.seen .dot{background:rgba(255,240,220,.4);box-shadow:none}
.tos .hot.nearby:not(.target) .ring{border-color:rgba(110,123,255,.62);box-shadow:0 0 12px rgba(51,70,255,.22)}\n.tos .hot.nearby:not(.target) .dot{background:#aeb5ff;box-shadow:0 0 8px rgba(110,123,255,.7)}\n.tos .hot.target .lbl{opacity:1;transform:translateX(-50%) translateY(0)}
.tos .hot:hover .ring,.tos .hot:focus-visible .ring{inset:9px}
.tos .hot.target .ring{border:2px solid ${BLUE_GLOW};box-shadow:0 0 16px ${BLUE};animation:tosPulse 1.4s ease-out infinite}
.tos .hot.target .dot{background:#fff;box-shadow:0 0 12px ${BLUE_GLOW}}
.tos .hot .lbl{position:absolute;top:58px;left:50%;transform:translateX(-50%) translateY(-3px);white-space:nowrap;padding:2px 10px;border-radius:6px;background:rgba(12,10,12,.82);color:${TEXT};font-family:VT323,monospace;font-size:19px;text-transform:uppercase;letter-spacing:.05em;opacity:0;pointer-events:none;transition:all .18s}
.tos .hot.target .lbl{background:${BLUE};color:#fff}
.tos .hot:hover .lbl,.tos .hot:focus-visible .lbl,.tos .hot.target .lbl{opacity:1;transform:translateX(-50%) translateY(0)}
@keyframes tosPulse{0%{box-shadow:0 0 0 0 rgba(110,123,255,.8)}100%{box-shadow:0 0 0 20px rgba(110,123,255,0)}}
@keyframes tosBlink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes tosBuzz{0%,100%{transform:translate(0,0)}25%{transform:translate(-2px,0)}75%{transform:translate(2px,0)}}
@keyframes tosBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes tosSway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes tosNod{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
.tos .act-bob{animation:tosBob 1.1s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.tos .act-sway{animation:tosSway 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.tos .act-nod{animation:tosNod 1.6s ease-in-out infinite;transform-box:fill-box}
@keyframes tosPop{0%{opacity:0;transform:scale(.2)}70%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}
@keyframes tosDust{0%{transform:translate(0,0);opacity:0}15%{opacity:.8}100%{transform:translate(30px,-120px);opacity:0}}
.tos .blink{animation:tosBlink 1.8s ease-in-out infinite}
.tos .buzz{animation:tosBuzz .12s linear infinite}
.tos .dust{position:absolute;width:3px;height:3px;border-radius:50%;background:#ffe2bc;box-shadow:0 0 6px #ffcf9a;animation:tosDust 9s linear infinite}
.tos .phone{position:absolute;left:50%;top:50%;width:min(400px,92vw);height:min(840px,94%);transform:translate(-50%,-50%);border-radius:46px;border:10px solid #07080b;background:${NIGHT};overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 0 120px rgba(51,70,255,.35),0 40px 80px rgba(0,0,0,.6)}
@media (max-width:700px){.tos .clear-badge{bottom:72px !important}}
@media (max-width:520px){.tos .phone{width:100%;height:100%;border-radius:0;border:0}}
@media (prefers-reduced-motion: reduce){.tos .hot.target .ring,.tos .blink,.tos .buzz,.tos .dust,.tos .act-bob,.tos .act-sway,.tos .act-nod{animation:none}}
`

/* ───────────────────────── Retro popup (the web's voice) ───────────────────────── */

function Win(props: { title: string; children: ReactNode; style?: CSSProperties; onClose?: () => void; alert?: boolean; titleId?: string }) {
    const { title, children, style, onClose, alert, titleId } = props
    return (
        <div style={{ background: PAPER, color: INK, border: `2px solid ${INK}`, boxShadow: "6px 6px 0 rgba(0,0,0,.55)", ...style }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: alert ? BLUE : INK, color: "#fff", padding: "1px 4px 1px 10px", minHeight: 30 }}>
                <span id={titleId} className="px" style={{ fontSize: 19, textTransform: "uppercase" }}>
                    {title}
                </span>
                {onClose ? (
                    <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 22, display: "grid", placeItems: "center", background: PAPER, color: INK, border: `2px solid ${INK}` }}>
                        <Icon name="x" size={13} />
                    </button>
                ) : (
                    <span aria-hidden="true" style={{ width: 18, height: 16, background: PAPER, border: `2px solid ${INK}` }} />
                )}
            </div>
            <div style={{ padding: 14 }}>{children}</div>
        </div>
    )
}

/* ───────────────────────── Apartment facade ───────────────────────── */

const FW = 1800
const FH = 2440
const FC = 9
const FR = 14
const VIEWER = { c: 2, r: 6 }
const STUDENT = { c: 6, r: 8 }
type Spot = { c: number; r: number }
type Lit = "blue" | "amber" | "bright" | "watcher"
type Level = "overview" | "near" | "inside"

function winRect(c: number, r: number) {
    return { x: c * 200 + 45, y: r * 170 + 40, w: 110, h: 92 }
}
function winCenter(s: Spot) {
    const w = winRect(s.c, s.r)
    return { x: w.x + w.w / 2, y: w.y + w.h / 2 }
}
const WATCH_ORDER = (() => {
    const all: string[] = []
    for (let r = 0; r < FR; r++) for (let c = 0; c < FC; c++) if (!(c === STUDENT.c && r === STUDENT.r) && !(c === VIEWER.c && r === VIEWER.r)) all.push(`${c}-${r}`)
    return all.sort((a, b) => {
        const [ac, ar] = a.split("-").map(Number)
        const [bc, br] = b.split("-").map(Number)
        return hash(ac, ar, 5) - hash(bc, br, 5)
    })
})()

function facadeView(level: Level, focus: Spot | null, w: number, h: number) {
    const s0 = Math.max(w / FW, h / FH)
    const p = focus ? winCenter(focus) : { x: FW / 2, y: FH / 2 }
    let scale = s0
    if (level === "near") scale = s0 * 2.4
    if (level === "inside") scale = Math.max(w / 104, h / 86) * 1.06
    let x = w / 2 - p.x * scale
    let y = h / 2 - p.y * scale
    x = clamp(x, w - FW * scale, 0)
    y = clamp(y, h - FH * scale, 0)
    return { x, y, scale }
}

/* window interiors seen through the magnifier */
function Activity(props: { kind: number; x: number; y: number }) {
    const { kind, x, y } = props
    const C = "#2a1a12"
    switch (kind) {
        case 0: // dinner
            return (
                <g fill={C}>
                    <circle cx={x + 34} cy={y + 34} r={8} />
                    <rect x={x + 26} y={y + 43} width={17} height={18} rx={6} />
                    <circle className="act-nod" cx={x + 68} cy={y + 32} r={8} />
                    <rect x={x + 60} y={y + 41} width={17} height={20} rx={6} />
                    <rect x={x + 18} y={y + 60} width={66} height={5} />
                    <ellipse cx={x + 51} cy={y + 58} rx={8} ry={3} fill="#fff6e6" />
                </g>
            )
        case 1: // working out
            return (
                <g fill={C} className="act-bob">
                    <rect x={x + 30} y={y + 14} width={40} height={4} />
                    <rect x={x + 28} y={y + 10} width={6} height={12} />
                    <rect x={x + 66} y={y + 10} width={6} height={12} />
                    <path d={`M${x + 38} ${y + 18}L${x + 45} ${y + 36}M${x + 62} ${y + 18}L${x + 55} ${y + 36}`} stroke={C} strokeWidth={4} />
                    <circle cx={x + 50} cy={y + 30} r={7} />
                    <rect x={x + 43} y={y + 38} width={14} height={24} rx={5} />
                    <rect x={x + 43} y={y + 60} width={5} height={20} />
                    <rect x={x + 52} y={y + 60} width={5} height={20} />
                </g>
            )
        case 2: // studying
            return (
                <g fill={C}>
                    <circle cx={x + 74} cy={y + 30} r={14} fill="#fff3d6" opacity={0.7} />
                    <circle className="act-nod" cx={x + 40} cy={y + 38} r={8} />
                    <path d={`M${x + 30} ${y + 76}C${x + 28} ${y + 56} ${x + 36} ${y + 46} ${x + 48} ${y + 48}L${x + 54} ${y + 62}Z`} />
                    <rect x={x + 40} y={y + 60} width={50} height={5} />
                    <rect x={x + 52} y={y + 54} width={16} height={6} fill="#fff6e6" />
                    <rect x={x + 76} y={y + 36} width={3} height={24} />
                </g>
            )
        case 3: // a couple, holding each other
            return (
                <g fill={C} className="act-sway">
                    <circle cx={x + 44} cy={y + 30} r={8} />
                    <circle cx={x + 57} cy={y + 33} r={7.5} />
                    <rect x={x + 35} y={y + 39} width={18} height={40} rx={7} />
                    <rect x={x + 48} y={y + 41} width={17} height={38} rx={7} />
                    <path d={`M${x + 40} ${y + 50}Q${x + 52} ${y + 46} ${x + 62} ${y + 52}`} stroke="#c98a5a" strokeWidth={2} fill="none" opacity={0.5} />
                </g>
            )
        case 4: // TV on the couch
            return (
                <g fill={C}>
                    <rect x={x + 74} y={y + 38} width={20} height={14} fill="#bfd0ff" opacity={0.9} />
                    <rect x={x + 10} y={y + 56} width={52} height={20} rx={6} />
                    <circle className="act-nod" cx={x + 32} cy={y + 44} r={8} />
                    <rect x={x + 24} y={y + 50} width={17} height={14} rx={5} />
                </g>
            )
        default: // cooking
            return (
                <g fill={C}>
                    <path d={`M${x + 62} ${y + 30}q4 -6 0 -12M${x + 70} ${y + 30}q4 -6 0 -12`} stroke="#fff6e6" strokeWidth={2} fill="none" opacity={0.8} />
                    <circle cx={x + 40} cy={y + 30} r={8} />
                    <rect x={x + 32} y={y + 39} width={17} height={40} rx={6} />
                    <g className="act-nod">
                        <rect x={x + 47} y={y + 46} width={18} height={4} />
                        <rect x={x + 58} y={y + 40} width={22} height={6} rx={2} />
                    </g>
                    <rect x={x + 54} y={y + 50} width={36} height={4} />
                </g>
            )
    }
}

function FacadeArt(props: { lit: Record<string, Lit>; level: Level; reticle?: Spot | null; life?: "life" | "phones" }) {
    const { lit, level, reticle, life } = props
    const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
    const walls = useMemo(() => {
        const out: ReactNode[] = []
        for (let r = 0; r < FR; r++) out.push(<rect key={`slab${r}`} x={0} y={r * 170 + 8} width={FW} height={4} fill="#3c4356" />)
        for (let c = 0; c <= FC; c++) out.push(<rect key={`seam${c}`} x={c * 200 - 1} y={0} width={2} height={FH} fill="#495064" />)
        for (let r = 0; r < FR; r++) out.push(<rect key={`log${r}`} x={4 * 200 + 16} y={r * 170 + 136} width={168} height={30} fill="#6d7488" />)
        return out
    }, [])
    const amber = `amb${uid}`
    const blueG = `blu${uid}`
    const blur = `blr${uid}`
    return (
        <svg viewBox={`0 0 ${FW} ${FH}`} width={FW} height={FH} style={{ display: "block" }}>
            <defs>
                <linearGradient id={`wall${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4c546a" />
                    <stop offset="1" stopColor="#5b6378" />
                </linearGradient>
                <linearGradient id={amber} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#FFD39A" />
                    <stop offset="1" stopColor="#F59A4A" />
                </linearGradient>
                <linearGradient id={blueG} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#8E98FF" />
                    <stop offset="1" stopColor={BLUE} />
                </linearGradient>
                <radialGradient id={`${blur}a`} cx=".5" cy=".5" r=".5">
                    <stop offset="0" stopColor={AMBER} stopOpacity=".85" />
                    <stop offset=".45" stopColor={AMBER} stopOpacity=".35" />
                    <stop offset="1" stopColor={AMBER} stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`${blur}b`} cx=".5" cy=".5" r=".5">
                    <stop offset="0" stopColor={BLUE} stopOpacity=".8" />
                    <stop offset=".45" stopColor={BLUE} stopOpacity=".3" />
                    <stop offset="1" stopColor={BLUE} stopOpacity="0" />
                </radialGradient>
            </defs>
            <rect width={FW} height={FH} fill={`url(#wall${uid})`} />
            {walls}
            {!life &&
                Object.entries(lit).map(([k, t]) => {
                    const [c, r] = k.split("-").map(Number)
                    const w = winRect(c, r)
                    const warm = t === "amber" || t === "bright"
                    const g = t === "bright" ? 90 : 40
                    return <ellipse key={`g${k}`} cx={w.x + w.w / 2} cy={w.y + w.h / 2} rx={w.w / 2 + g * 1.4} ry={w.h / 2 + g * 1.4} fill={`url(#${blur}${warm ? "a" : "b"})`} opacity={t === "bright" ? 1 : warm ? 0.7 : 0.6} />
                })}
            {Array.from({ length: FR }).flatMap((_, r) =>
                Array.from({ length: FC }).map((__, c) => {
                    const k = `${c}-${r}`
                    const t: Lit | undefined = life === "phones" ? "watcher" : life ? undefined : lit[k]
                    const w = winRect(c, r)
                    const h1 = hash(c, r, 1)
                    const lifeLit = life === "life"
                    const glass = lifeLit ? (h1 < 0.5 ? `url(#${amber})` : "#f2e3c8") : t === "amber" || t === "bright" ? `url(#${amber})` : t ? `url(#${blueG})` : h1 < 0.5 ? "#1a1f2b" : "#232938"
                    const mx = w.x + w.w * (h1 < 0.5 ? 0.42 : 0.58)
                    return (
                        <g key={k}>
                            <rect x={w.x} y={w.y} width={w.w} height={w.h} fill="#c9ccd4" />
                            <rect x={w.x + 5} y={w.y + 5} width={w.w - 10} height={w.h - 10} fill={glass} />
                            {lifeLit && <Activity kind={Math.floor(hash(c, r, 9) * 6)} x={w.x + 5} y={w.y + 5} />}
                            {!t && !lifeLit && h1 > 0.62 && <rect x={w.x + 5} y={w.y + 5} width={(w.w - 10) * 0.45} height={w.h - 10} fill="#8f95a5" opacity={0.35} />}
                            {(t === "amber" || t === "bright") && (
                                <g>
                                    <rect x={w.x + 5} y={w.y + 5} width={30} height={w.h - 10} fill="#fff1db" opacity={0.45} />
                                    {level !== "inside" && <circle cx={w.x + 70} cy={w.y + 40} r={9} fill="#2a1a12" />}
                                    {level !== "inside" && <rect x={w.x + 57} y={w.y + 52} width={26} height={35} rx={8} fill="#2a1a12" />}
                                </g>
                            )}
                            {t === "watcher" && (
                                <g>
                                    <circle cx={w.x + w.w / 2} cy={w.y + 50} r={13} fill="#0b0d1a" />
                                    <rect x={w.x + w.w / 2 - 26} y={w.y + 64} width={52} height={23} rx={10} fill="#0b0d1a" />
                                    <rect x={w.x + w.w / 2 + 8} y={w.y + 60} width={10} height={16} fill="#dfe3ff" />
                                </g>
                            )}
                            <path d={`M${mx} ${w.y + 5}V${w.y + w.h - 5} M${w.x + 5} ${w.y + w.h * 0.3}H${mx}`} stroke="#c9ccd4" strokeWidth={4} />
                            <rect x={w.x - 6} y={w.y + w.h} width={w.w + 12} height={7} fill="#727a8e" />
                            {h1 > 0.86 && <rect x={w.x + w.w - 30} y={w.y + w.h + 10} width={30} height={22} fill="#b8bcc6" />}
                        </g>
                    )
                })
            )}
            {!life && <rect width={FW} height={FH} fill="#1b2238" opacity={0.25} style={{ mixBlendMode: "multiply" }} />}
            {reticle &&
                (() => {
                    const w = winRect(reticle.c, reticle.r)
                    const p = 26
                    const L = 30
                    const x0 = w.x - p
                    const y0 = w.y - p
                    const x1 = w.x + w.w + p
                    const y1 = w.y + w.h + p
                    return <path d={`M${x0} ${y0 + L}V${y0}H${x0 + L} M${x1 - L} ${y0}H${x1}V${y0 + L} M${x1} ${y1 - L}V${y1}H${x1 - L} M${x0 + L} ${y1}H${x0}V${y1 - L}`} fill="none" stroke="#fff" strokeWidth={5} />
                })()}
        </svg>
    )
}

const LENS = 270

function Facade(props: {
    lit: Record<string, Lit>
    focus: Spot | null
    level: Level
    initialLevel?: Level
    duration?: number
    reticle?: Spot | null
    style?: CSSProperties
    still?: boolean
    lens?: { x: number; y: number; phones: boolean } | null
}) {
    const { lit, focus, level, initialLevel, duration = 1.4, reticle, style, still, lens } = props
    const ref = useRef<HTMLDivElement>(null)
    const box = useBox(ref)
    const v = facadeView(level, focus, box.w, box.h)
    const v0 = facadeView(initialLevel || level, focus, box.w, box.h)
    const lx = lens ? lens.x * box.w : 0
    const ly = lens ? lens.y * box.h : 0
    const S = v.scale * 1.6
    const fx = (lx - v.x) / v.scale
    const fy = (ly - v.y) / v.scale

    return (
        <div ref={ref} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#2a3040", ...style }}>
            {box.ok && (
                <motion.div initial={{ x: v0.x, y: v0.y, scale: v0.scale }} animate={{ x: v.x, y: v.y, scale: v.scale }} transition={still ? { duration: 0 } : { duration, ease: [0.65, 0, 0.25, 1] }} style={{ position: "absolute", left: 0, top: 0, width: FW, height: FH, transformOrigin: "0 0" }}>
                    <FacadeArt lit={lit} level={level} reticle={reticle} />
                </motion.div>
            )}
            <AnimatePresence>
                {box.ok && lens && (
                    <motion.div
                        key="lens"
                        initial={false}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.6 } }}
                        style={{ position: "absolute", left: lx - LENS / 2, top: ly - LENS / 2, width: LENS, height: LENS, pointerEvents: "none", zIndex: 3 }}
                    >
                        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", border: "3px solid rgba(243,237,228,.9)", boxShadow: lens.phones ? `0 0 60px ${BLUE}, 0 20px 50px rgba(0,0,0,.6)` : "0 0 60px rgba(255,184,103,.45), 0 20px 50px rgba(0,0,0,.6)" }}>
                            <div style={{ position: "absolute", left: 0, top: 0, width: FW, height: FH, transformOrigin: "0 0", transform: `translate(${LENS / 2 - fx * S}px, ${LENS / 2 - fy * S}px) scale(${S})` }}>
                                <FacadeArt lit={{}} level="overview" life={lens.phones ? "phones" : "life"} />
                            </div>
                            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,.18), transparent 45%)" }} />
                        </div>
                        <div style={{ position: "absolute", width: 16, height: 70, borderRadius: 8, background: "#d9d4ca", border: "2px solid #8a857b", left: LENS - 32, top: LENS - 22, transform: "rotate(-45deg)", transformOrigin: "50% 0" }} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/* ───────────────────────── Room scene (warm, cinematic) ───────────────────────── */

function RoomSVG(props: { beat: number; buzz: boolean }) {
    const { beat, buzz } = props
    const morning = beat >= 2
    return (
        <svg viewBox="0 0 1600 900" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true" style={{ display: "block" }}>
            <defs>
                <linearGradient id="rWall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2b2230" />
                    <stop offset="1" stopColor="#3b2d2c" />
                </linearGradient>
                <pattern id="rStripe" width="34" height="34" patternUnits="userSpaceOnUse">
                    <rect x="0" y="0" width="3" height="34" fill="#ffe0bd" opacity=".05" />
                    <rect x="16" y="0" width="1" height="34" fill="#000" opacity=".12" />
                </pattern>
                <radialGradient id="rLamp" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0" stopColor="#FFB45E" stopOpacity=".62" />
                    <stop offset=".5" stopColor="#FF9A45" stopOpacity=".18" />
                    <stop offset="1" stopColor="#FF9A45" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="rScreen" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0" stopColor={BLUE_GLOW} stopOpacity=".5" />
                    <stop offset="1" stopColor={BLUE} stopOpacity="0" />
                </radialGradient>
                <linearGradient id="rWood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#9a6a43" />
                    <stop offset="1" stopColor="#5b3c27" />
                </linearGradient>
                <linearGradient id="rWoodDark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4a3122" />
                    <stop offset="1" stopColor="#24170f" />
                </linearGradient>
                <linearGradient id="rScreenFill" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#5767FF" />
                    <stop offset="1" stopColor="#2733C8" />
                </linearGradient>
                <linearGradient id="rBeige" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#efe6d2" />
                    <stop offset="1" stopColor="#b9ad96" />
                </linearGradient>
                <linearGradient id="rSky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={morning ? "#7d8aa6" : "#1a2033"} />
                    <stop offset="1" stopColor={morning ? "#d9a27a" : "#2d3550"} />
                </linearGradient>
                <linearGradient id="rBeam" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ffd7a8" stopOpacity=".14" />
                    <stop offset="1" stopColor="#ffd7a8" stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* wall */}
            <rect width="1600" height="660" fill="url(#rWall)" />
            <rect width="1600" height="640" fill="url(#rStripe)" />
            <rect x="0" y="0" width="1600" height="26" fill="#1b1519" />
            {/* floor */}
            <rect y="640" width="1600" height="260" fill="#1a1315" />
            <rect y="636" width="1600" height="8" fill="#120d0f" />
            {/* window to the outside: the building across */}
            <rect x="122" y="112" width="416" height="346" fill="#21171a" />
            <rect x="140" y="130" width="380" height="310" fill="url(#rSky)" />
            {[0, 1, 2].map((bx) => (
                <g key={bx}>
                    <rect x={150 + bx * 130} y={170 - bx * 20} width="110" height="270" fill={morning ? "#5e6780" : "#3a4255"} />
                    {Array.from({ length: 12 }).map((_, k) => {
                        const wx = 160 + bx * 130 + (k % 3) * 34
                        const wy = 186 - bx * 20 + Math.floor(k / 3) * 58
                        const viewer = bx === 1 && k === 4
                        const watcher = false
                        return (
                            <g key={k}>
                                <rect x={wx} y={wy} width="22" height="30" fill={viewer || watcher ? BLUE_GLOW : morning ? "#3d455a" : "#1a1f2c"} />
                                {(viewer || watcher) && <rect x={wx - 6} y={wy - 6} width="34" height="42" fill={BLUE} opacity=".25" />}
                                {watcher && <rect x={wx + 6} y={wy + 12} width="10" height="18" fill="#0b0d1a" />}
                            </g>
                        )
                    })}
                </g>
            ))}
            <rect x="326" y="130" width="8" height="310" fill="#21171a" />
            <path d="M104 100 C140 240 100 380 150 476 L86 476 L86 100 Z" fill="#5b3a33" />
            <path d="M556 100 C520 240 560 380 512 476 L574 476 L574 100 Z" fill="#5b3a33" />
            <path d="M104 100 C140 240 100 380 150 476" stroke="#8a5a48" strokeWidth="4" fill="none" opacity=".6" />
            {/* light beam */}
            <polygon points="250,0 560,0 1180,640 760,640" fill="url(#rBeam)" />
            {/* calendar */}
            <rect x="598" y="160" width="172" height="196" fill="#e8dfcf" />
            <rect x="598" y="160" width="172" height="30" fill="#8b3a2b" />
            {Array.from({ length: 20 }).map((_, i) => {
                const cx = 612 + (i % 5) * 31
                const cy = 204 + Math.floor(i / 5) * 36
                const busy = [1, 2, 3, 6, 7, 8, 9, 11, 12, 13].includes(i)
                return (
                    <g key={i}>
                        <rect x={cx} y={cy} width="26" height="30" fill="#f4eee3" stroke="#cfc4b0" />
                        {busy && <rect x={cx + 3} y={cy + 18} width="20" height="7" fill="#4a3b33" />}
                    </g>
                )
            })}
            <circle cx="753" cy="219" r="16" fill="none" stroke="#b5432f" strokeWidth="3" />
            <rect x="598" y="160" width="172" height="196" fill="#000" opacity=".25" />
            {/* shelf */}
            <rect x="850" y="262" width="340" height="14" fill="url(#rWood)" />
            <rect x="850" y="276" width="340" height="6" fill="#20150f" />
            <rect x="880" y="236" width="56" height="26" rx="6" fill="#c9c0b0" />
            <rect x="950" y="230" width="70" height="32" rx="6" fill="#d8d0c0" />
            <rect x="1040" y="240" width="60" height="22" rx="6" fill="#b9b0a0" />
            {/* poster */}
            <rect x="1210" y="160" width="130" height="170" fill="#1d1a1f" />
            <rect x="1222" y="172" width="106" height="110" fill="#3c3340" />
            <circle cx="1275" cy="226" r="30" fill="#8a5a48" opacity=".7" />
            <rect x="1222" y="292" width="80" height="8" fill="#cfc4b0" opacity=".6" />
            {/* lamp glow */}
            <circle cx="1290" cy="460" r="520" fill="url(#rLamp)" />
            {/* desk */}
            <path d="M800 556 H1400 L1410 584 H790 Z" fill="url(#rWood)" />
            <path d="M790 584 H1410" stroke="#d29a68" strokeWidth="2" opacity=".7" />
            <rect x="820" y="584" width="24" height="220" fill="url(#rWoodDark)" />
            <rect x="1180" y="584" width="200" height="150" fill="url(#rWoodDark)" />
            <rect x="1190" y="600" width="180" height="56" fill="#2f2018" />
            <rect x="1265" y="624" width="30" height="5" fill="#a77850" />
            {/* computer (CRT) */}
            <circle cx="1080" cy="470" r="270" fill="url(#rScreen)" />
            <rect x="1020" y="526" width="120" height="30" fill="#a89c86" />
            <rect x="986" y="370" width="188" height="160" rx="10" fill="url(#rBeige)" />
            <rect x="1004" y="386" width="152" height="118" rx="4" fill="url(#rScreenFill)" />
            <rect x="1004" y="386" width="152" height="10" fill="#7d8bff" opacity=".6" />
            <rect x="1040" y="440" width="80" height="5" fill="#dfe3ff" opacity=".85" />
            <rect x="1004" y="386" width="152" height="118" rx="4" fill="#fff" opacity=".06" />
            <circle cx="1160" cy="518" r="3" fill="#5bff8a" />
            <rect x="992" y="548" width="160" height="12" rx="3" fill="#d9cfbb" />
            {/* phone */}
            <g className={buzz ? "buzz" : undefined}>
                {buzz && <circle cx="886" cy="548" r="60" fill={BLUE_GLOW} opacity=".25" />}
                <rect x="860" y="540" width="52" height="16" rx="4" fill="#0e0e12" />
                {buzz && <rect x="864" y="542" width="44" height="12" rx="2" fill="#dfe3ff" />}
            </g>
            {/* mug */}
            <rect x="932" y="520" width="32" height="38" rx="4" fill="#ece4d6" />
            <path d="M964 528 q14 10 0 22" stroke="#ece4d6" strokeWidth="5" fill="none" />
            {/* CDs */}
            <ellipse cx="1180" cy="566" rx="24" ry="7" fill="#d9dbe3" opacity=".8" />
            {/* bills */}
            <g transform="rotate(-6 1255 545)">
                <rect x="1212" y="534" width="88" height="22" fill="#e9e2d4" />
                <rect x="1218" y="526" width="86" height="24" fill="#f5efe4" />
                <rect x="1226" y="532" width="36" height="7" fill="#b5432f" />
                <rect x="1226" y="543" width="60" height="3" fill="#9e9586" />
            </g>
            {/* lamp */}
            <rect x="1320" y="546" width="50" height="12" rx="3" fill="#18141a" />
            <path d="M1345 548 L1320 460 L1280 450" stroke="#18141a" strokeWidth="8" fill="none" />
            <path d="M1250 430 l60 10 -10 30 -60 -10 Z" fill="#18141a" />
            <ellipse cx="1272" cy="466" rx="26" ry="6" fill="#FFE2B0" />
            {/* plant */}
            <rect x="1376" y="512" width="34" height="44" fill="#8a4a33" />
            <path d="M1392 512 C1380 470 1350 460 1340 440 M1394 512 C1400 460 1420 440 1440 430 M1393 512 C1393 470 1396 450 1392 420" stroke="#3f5a3a" strokeWidth="6" fill="none" />
            {/* door */}
            <rect x="1420" y="190" width="170" height="452" fill="url(#rWoodDark)" />
            <rect x="1440" y="215" width="130" height="180" fill="#000" opacity=".18" />
            <rect x="1440" y="420" width="130" height="190" fill="#000" opacity=".18" />
            <circle cx="1446" cy="420" r="7" fill="#c9a06a" />
            <rect x="1420" y="638" width="170" height="6" fill="#FFCF8A" opacity=".75" />
            {/* bed */}
            <path d="M0 600 C120 574 420 574 580 612 L580 700 L0 700 Z" fill="#2c2f3f" />
            <path d="M0 604 C140 580 400 580 580 614" stroke="#6a5a66" strokeWidth="3" fill="none" opacity=".6" />
            <ellipse cx="90" cy="596" rx="88" ry="24" fill="#8f877c" />
            <rect y="700" width="580" height="40" fill="#120d10" />
            {/* backpack */}
            <path d="M690 650 q0 -60 50 -60 q50 0 50 60 v80 h-100 Z" fill="#4a2a26" />
            <rect x="710" y="670" width="60" height="30" rx="4" fill="#3a201d" />
            {/* chair foreground */}
            <path d="M20 900 C10 760 40 690 120 660 C200 630 330 640 380 700 C420 750 420 840 410 900 Z" fill="#0c0a0b" />
            <path d="M120 662 C200 636 320 646 372 700" stroke="#3a2f2c" strokeWidth="3" fill="none" opacity=".7" />
            {/* camera */}
            {beat >= 1 && (
                <g>
                    <rect x="1496" y="30" width="64" height="30" rx="5" fill="#16141a" />
                    <circle cx="1510" cy="45" r="10" fill="#2a2d3c" />
                    <circle cx="1510" cy="45" r="4" fill="#8f97b8" />
                    <rect x="1556" y="22" width="10" height="20" fill="#16141a" />
                    <circle className="blink" cx="1546" cy="40" r="4" fill={BLUE_GLOW} />
                </g>
            )}
        </svg>
    )
}

/* ───────────────────────── Main component ───────────────────────── */

interface Props {
    storyHandle: string
    caption: string
    startAt?: "intro" | "profile" | "feed" | "pov" | "room" | "yourpost" | "yourmove"
    style?: CSSProperties
}

/**
 * THE OTHER SIDE — a building at night → a feed → a comment → a life → a crowd.
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function TheOtherSide(props: Props) {
    const { storyHandle = "room017", caption = "dropped out at 20 lol 💀 #college" } = props
    const reduce = useReducedMotion() || false

    const startAt = props.startAt || "intro"
    const firstPhase = (a: typeof startAt): Phase => (a === "intro" ? "profile" : a === "pov" ? "transit" : a)
    const [phase, setPhase] = useState<Phase>(firstPhase(startAt))
    useEffect(() => {
        setPhase(firstPhase(startAt))
        if (startAt !== "intro" && startAt !== "feed" && startAt !== "profile") setLiked("c1")
        if (startAt === "pov") setTransitStep(3)
    }, [startAt])
    const [introStep, setIntroStep] = useState(0)
    const [transitStep, setTransitStep] = useState(0)
    const [drawer, setDrawer] = useState(false)
    const [storyLiked, setStoryLiked] = useState(false)
    const [liked, setLiked] = useState<string | null>(null)
    const [coachSeen, setCoachSeen] = useState(false)
    const [visited, setVisited] = useState<ObjId[]>([])
    const [beat, setBeat] = useState(0)
    const [picks, setPicks] = useState<Option[]>([])
    const [stats, setStats] = useState<Stats>(START)
    const [open, setOpen] = useState<ObjId | null>(null)
    const [outcome, setOutcome] = useState<Option | null>(null)
    const [socratic, setSocratic] = useState<string | null>(null)
    const [hint, setHint] = useState<ObjId | null>(null)
    const [roomStage, setRoomStage] = useState(0) // 0 inner thought · 1 messages pour in · 2 the boss texts
    const [unlocked, setUnlocked] = useState<ObjId[]>([])
    const [newComment, setNewComment] = useState<string | null>(null)
    const [draft, setDraft] = useState("")
    const [done, setDone] = useState(false)
    const [watchStep, setWatchStep] = useState(0)
    const [watchers, setWatchers] = useState(0)
    const [flash, setFlash] = useState<string | null>(null)
    const [endStep, setEndStep] = useState(0)
    const [profile, setProfile] = useState<Profile | null>(null)
    const prof = profile || DEFAULT_PROFILE

    useEffect(() => {
        if (safeGet("tos.coach")) setCoachSeen(true)
        setProfile(loadProfile())
    }, [])

    const likedComment = COMMENTS.find((c) => c.id === liked) || null
    /* inner monologue: what the student is thinking, and where to look next */
    const guideInfo = ((): { obj: ObjId | null; text: string } | null => {
        if (phase !== "room" || beat >= 3) return null
        if (beat === 0) {
            if (roomStage === 0) return { obj: null, text: "Rent’s due Friday. So is the exam." }
            if (roomStage === 1) return null
            return { obj: "phone", text: "Work again…? I should answer." }
        }
        if (beat === 1) {
            const ev = likedComment?.evidence
            if (ev && ev !== "bills" && !visited.includes(ev)) return { obj: ev, text: EVIDENCE_THOUGHT[ev] }
            return { obj: "bills", text: "Okay. The bills. How bad is it?" }
        }
        if (!visited.includes("door") && likedComment?.evidence !== "door") return { obj: "laptop", text: "An email from my advisor… it’s on the computer." }
        return { obj: "laptop", text: "My advisor wrote back. On the computer." }
    })()
    const target: ObjId | null = guideInfo?.obj ?? null

    const resetRun = useCallback(() => {
        setVisited([])
        setBeat(0)
        setPicks([])
        setStats(START)
        setOpen(null)
        setOutcome(null)
        setSocratic(null)
        setHint(null)
        setRoomStage(0)
        setUnlocked([])
        setWatchStep(0)
        setWatchers(0)
    }, [])

    /* ── intro: lives behind windows → everyone picks up their phone → the post lands ── */
    const [lensPos, setLensPos] = useState({ x: 0.5, y: 0.46 })
    const [loading, setLoading] = useState(startAt === "intro")
    const [crowdLit, setCrowdLit] = useState(0)
    const beginIntro = () => {
        if (introStep !== 0 || loading) return
        setIntroStep(1)
    }
    useEffect(() => {
        if (phase !== "intro" || introStep !== 1) return
        const t = window.setTimeout(() => {
            ding()
            setIntroStep(2)
        }, reduce ? 300 : 2200)
        return () => window.clearTimeout(t)
    }, [phase, introStep, reduce])
    useEffect(() => {
        if (phase !== "intro" || introStep < 1 || crowdLit >= 54) return
        const t = window.setTimeout(() => setCrowdLit((n) => Math.min(54, n + 3)), reduce ? 0 : 70)
        return () => window.clearTimeout(t)
    }, [phase, introStep, crowdLit, reduce])

    const openFeed = () => startTransition(() => setPhase("feed"))
    const onProfileDone = (p: Profile) => {
        setProfile(p)
        safeSet("tos.profile", JSON.stringify(p))
        startTransition(() => {
            setPhase("intro")
            setIntroStep(0)
        })
    }

    /* ── like a comment → zoom out → into another window ── */
    const likeComment = (id: string) => {
        if (liked) return
        setLiked(id)
        setCoachSeen(true)
        safeSet("tos.coach", "1")
        window.setTimeout(() => {
            startTransition(() => {
                setDrawer(false)
                resetRun()
                setTransitStep(0)
                setPhase("transit")
            })
        }, reduce ? 200 : 700)
    }
    useEffect(() => {
        if (phase !== "transit" || startAt === "pov") return
        const seq = reduce ? [100, 300, 600, 1400, 4600] : [1500, 2300, 4500, 7300, 11200]
        const ts = seq.map((ms, i) => window.setTimeout(() => (i < 4 ? setTransitStep(i + 1) : setPhase("room")), ms))
        return () => ts.forEach((t) => window.clearTimeout(t))
    }, [phase, reduce])

    const toFeed = () => {
        startTransition(() => {
            setPhase("feed")
            setDrawer(false)
            setLiked(null)
            resetRun()
        })
    }

    /* ── room ── */
    // ① inner thought alone → ② the phone fills with messages → ③ the boss
    useEffect(() => {
        if (phase !== "room" || beat !== 0 || roomStage >= 2) return
        const t = window.setTimeout(() => setRoomStage((n) => n + 1), roomStage === 0 ? (reduce ? 400 : 3000) : reduce ? 900 : 4900)
        return () => window.clearTimeout(t)
    }, [phase, beat, roomStage, reduce])
    // an object only becomes clickable after a thought has pointed at it
    useEffect(() => {
        // wait until the open card is closed, so the next object never lights up behind it
        if (phase !== "room" || !target || unlocked.includes(target) || open || outcome) return
        const t = window.setTimeout(() => setUnlocked((u) => (u.includes(target) ? u : [...u, target])), reduce ? 0 : 1100)
        return () => window.clearTimeout(t)
    }, [phase, target, unlocked, reduce, open, outcome])
    useEffect(() => {
        if (phase !== "room" || open || outcome) return
        setHint(null)
        const t = window.setTimeout(() => setHint(target), 8000)
        return () => window.clearTimeout(t)
    }, [phase, open, outcome, target, visited])

    /* ── watched: the building lights up, one screen at a time ── */
    useEffect(() => {
        if (phase !== "watched") return
        if (reduce) {
            setWatchStep(5)
            setWatchers(60)
            return
        }
        setWatchStep(0)
        setWatchers(0)
        const ts = [900, 1500, 2100, 3000, 3700].map((ms, i) => window.setTimeout(() => setWatchStep(i + 1), ms))
        return () => ts.forEach((t) => window.clearTimeout(t))
    }, [phase, reduce])
    useEffect(() => {
        if (phase !== "watched" || watchStep < 1 || watchers >= 60) return
        const t = window.setTimeout(() => setWatchers((n) => Math.min(60, n + 3)), 90)
        return () => window.clearTimeout(t)
    }, [phase, watchStep, watchers])

    useEffect(() => {
        if (typeof window === "undefined") return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return
            if (drawer) setDrawer(false)
            else if (open && !outcome) setOpen(null)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [drawer, open, outcome])

    const openObj = (id: ObjId) => {
        setSocratic(null)
        setHint(null)
        setVisited((v) => (v.includes(id) ? v : [...v, id]))
        setOpen(id)
    }
    const choose = (opt: Option) => {
        setStats((s) => ({
            money: s.money + (opt.d.money || 0),
            energy: clamp(s.energy + (opt.d.energy || 0), 0, 100),
            grade: clamp(s.grade + (opt.d.grade || 0), 0, 100),
        }))
        setPicks((p) => [...p, opt])
        setOutcome(opt)
        setFlash(opt.outside)
    }
    const afterOutcome = () => {
        const next = beat + 1
        startTransition(() => {
            setOutcome(null)
            setOpen(null)
            setFlash(null)
            setBeat(next)
            if (next >= 3) window.setTimeout(() => setPhase("watched"), reduce ? 0 : 500)
            else setHint(null)
        })
    }
    const askSocratic = () => {
        if (!socratic) return
        let pick: ObjId
        if (beat === 1) {
            const ev = likedComment?.evidence
            pick = ev && !visited.includes(ev) ? ev : (["calendar", "door", "laptop", "bills"] as ObjId[]).find((o) => !visited.includes(o)) || "calendar"
        } else pick = "phone"
        setSocratic(null)
        setHint(pick)
    }
    const finishMove = (r: { unliked: boolean; text: string | null }) => {
        if (r.text) {
            setNewComment(r.text)
            safeSet("tos.comment", r.text)
        }
        setEndStep(0)
        startTransition(() => setPhase("ending"))
    }
    const replayAll = () => {
        startTransition(() => {
            resetRun()
            setLiked(null)
            setDone(false)
            setDrawer(false)
            setNewComment(null)
            setCrowdLit(0)
            setIntroStep(0)
            setEndStep(0)
            setPhase("profile")
        })
    }
    // ending: the line → the windows go dark → the title card
    useEffect(() => {
        if (phase !== "ending" || endStep >= 3) return
        const wait = [2400, 3000, 1500][endStep]
        const t = window.setTimeout(() => setEndStep((n) => n + 1), reduce ? 100 : wait)
        return () => window.clearTimeout(t)
    }, [phase, endStep, reduce])
    useEffect(() => {
        if (phase !== "notify") return
        const t = window.setTimeout(ding, reduce ? 200 : 1800)
        return () => window.clearTimeout(t)
    }, [phase, reduce])

    /* ── bridges: into the student's window → out to the building → into your window ── */
    const [viewStep, setViewStep] = useState(0)
    useEffect(() => {
        if (phase === "toStudent") {
            const t = window.setTimeout(() => setPhase("yourpost"), reduce ? 200 : 2100)
            return () => window.clearTimeout(t)
        }
        if (phase !== "toViewer") return
        setViewStep(0)
        const seq = reduce ? [100, 200, 400] : [700, 2400, 4500]
        const ts = seq.map((ms, i) => window.setTimeout(() => (i < 2 ? setViewStep(i + 1) : setPhase("notify")), ms))
        return () => ts.forEach((t) => window.clearTimeout(t))
    }, [phase, reduce])

    /* ── facade state per phase ── */
    const facade = useMemo(() => {
        const lit: Record<string, Lit> = {}
        const v = `${VIEWER.c}-${VIEWER.r}`
        const s = `${STUDENT.c}-${STUDENT.r}`
        let level: Level = "overview"
        let focus: Spot | null = null
        let duration = 1.4
        const crowd = (n: number) => {
            WATCH_ORDER.slice(0, n).forEach((k) => (lit[k] = "watcher"))
            lit[v] = "watcher"
        }
        if (phase === "intro") {
            if (introStep >= 1) crowd(crowdLit)
            if (introStep >= 2) {
                level = "near"
                focus = VIEWER
                duration = 1.6
            }
        } else if (phase === "feed") {
            crowd(54)
            level = "near"
            focus = VIEWER
        } else if (phase === "transit") {
            crowd(54)
            if (transitStep >= 1) lit[s] = "amber"
            level = transitStep >= 2 ? "inside" : "overview"
            focus = transitStep >= 2 ? STUDENT : null
            duration = transitStep >= 2 ? 2.2 : 1.4
        } else if (phase === "watched") {
            lit[s] = "amber"
            WATCH_ORDER.slice(0, watchers).forEach((k) => (lit[k] = "watcher"))
            focus = STUDENT
            duration = 1.6
        } else if (phase === "toStudent") {
            lit[s] = "amber"
            WATCH_ORDER.slice(0, 60).forEach((k) => (lit[k] = "watcher"))
            level = "inside"
            focus = STUDENT
            duration = 1.9
        } else if (phase === "toViewer") {
            lit[s] = "amber"
            lit[v] = "watcher"
            if (viewStep === 0) {
                level = "near" // never start from "inside": a 20× SVG fails to paint while zooming out
                focus = STUDENT
            } else if (viewStep === 1) {
                duration = 1.6
            } else {
                level = "near"
                focus = VIEWER
                duration = 1.9
            }
        } else if (phase === "notify" || phase === "yourmove") {
            lit[v] = "watcher"
            lit[s] = "amber"
            focus = VIEWER
            level = "near"
            duration = 2.2
        } else if (phase === "ending") {
            if (endStep < 2) {
                lit[v] = "watcher"
                lit[s] = "amber"
            }
            duration = 2.4
        }
        const reticleAt: Spot | null = phase === "watched" && watchStep >= 1 ? STUDENT : null
        return { lit, level, focus, duration, reticleAt }
    }, [phase, introStep, transitStep, watchers, watchStep, crowdLit, endStep, viewStep])

    const showFacade = phase === "profile" || phase === "intro" || phase === "feed" || (phase === "transit" && transitStep < 4) || phase === "watched" || phase === "toStudent" || phase === "toViewer" || phase === "notify" || phase === "yourmove" || phase === "ending"
    const progress = phase === "profile" || phase === "intro" || phase === "feed" ? 0 : phase === "transit" || phase === "room" ? 1 : phase === "watched" || phase === "toStudent" ? 2 : phase === "yourpost" ? 3 : 4
    const behindPhone = phase === "feed" || phase === "yourmove" || phase === "profile"
    const facadeKey = phase === "watched" || phase === "toStudent" ? "fw" : phase === "ending" ? "fe" : phase === "toViewer" || phase === "notify" || phase === "yourmove" ? "fn" : "fm"
    const finalCaption = picks[2]?.id === "stay" ? "on academic probation lol 💀 #college" : caption

    return (
        <div className="tos" style={{ ...props.style, position: "relative", width: "100%", height: "100%", overflow: "hidden", background: NIGHT }}>
            <style>{CSS}</style>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=VT323&family=Instrument+Serif:ital@0;1&display=swap" />

            {showFacade && (
                <motion.div
                    key={facadeKey}
                    initial={{ opacity: facadeKey === "fm" ? 1 : 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                    style={{ position: "absolute", inset: 0, filter: behindPhone ? "blur(6px) brightness(.55)" : "blur(0px) brightness(1)", transition: "filter .8s ease" }}
                >
                    <Facade lit={facade.lit} level={facade.level} focus={facade.focus} duration={reduce ? 0.01 : facade.duration} initialLevel={phase === "watched" ? "near" : undefined} reticle={facade.reticleAt} lens={phase === "intro" && introStep < 2 ? { ...lensPos, phones: introStep >= 1 } : null} />
                    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                        <div className="grain" />
                    </div>
                    <div className="vignette" />
                </motion.div>
            )}

            {phase !== "profile" && phase !== "intro" && phase !== "feed" && phase !== "yourmove" && phase !== "ending" && (
                <TopBar progress={progress} onBack={toFeed} onSkip={phase === "watched" && watchStep < 5 ? () => { setWatchStep(5); setWatchers(60) } : phase === "yourpost" ? () => setPhase("toViewer") : undefined} />
            )}

            <AnimatePresence>{loading && (phase === "profile" || phase === "intro") && <Loader onDone={() => setLoading(false)} reduce={reduce} />}</AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
                {phase === "profile" && !loading && (
                    <motion.div key="profile" initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduce ? 1 : 0.94 }} transition={{ duration: 0.45 }} style={{ position: "absolute", inset: 0 }}>
                        <div className="phone">
                            <ProfileSetup initial={profile} onDone={onProfileDone} reduce={reduce} />
                        </div>
                    </motion.div>
                )}

                {phase === "intro" && (
                    <motion.div key="intro" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} style={{ position: "absolute", inset: 0 }}>
                        <Intro step={introStep} onBegin={beginIntro} onOpen={openFeed} handle={storyHandle} caption={caption} reduce={reduce} onLens={(x, y) => introStep === 0 && setLensPos({ x, y })} />
                    </motion.div>
                )}

                {phase === "feed" && (
                    <motion.div key="feed" initial={{ opacity: 0, scale: reduce ? 1 : 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduce ? 1 : 0.9 }} transition={{ duration: 0.45 }} style={{ position: "absolute", inset: 0 }}>
                        <div className="phone">
                            <Feed
                                handle={storyHandle}
                                caption={caption}
                                storyLiked={storyLiked}
                                onStoryLike={() => setStoryLiked((v) => !v)}
                                onComments={() => setDrawer(true)}
                                done={done}
                                onReplay={() => {
                                    setDone(false)
                                    setNewComment(null)
                                    safeSet("tos.comment", "")
                                    setDrawer(true)
                                }}
                            />
                            <Drawer open={drawer} onClose={() => setDrawer(false)} liked={liked} onLike={likeComment} showCoach={!coachSeen && !done} mine={done ? newComment : null} reduce={reduce} />
                        </div>
                    </motion.div>
                )}

                {phase === "transit" && (
                    <motion.div key="transit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} style={{ position: "absolute", inset: 0, cursor: "default", userSelect: "none" }}>
                        <AnimatePresence>
                            {transitStep >= 3 && (
                                <motion.div key="pov" initial={startAt === "pov" ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} style={{ position: "absolute", inset: 0 }}>
                                    <PhonePOV lowered={transitStep >= 4} liked={likedComment} handle={storyHandle} caption={caption} reduce={reduce} still={startAt === "pov"} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                {phase === "room" && (
                    <motion.div key="room" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }} style={{ position: "absolute", inset: 0 }}>
                        <Room beat={beat} visited={visited} target={target} hint={hint} onOpen={openObj} reduce={reduce} flash={flash} pops={roomStage >= 1 && beat === 0 && !open && picks.length === 0} unlocked={unlocked} picks={picks} blocked={!!open || !!outcome} />
                        <ScreenAudience picks={picks} reduce={reduce} />
                        <Hud stats={stats} clock={CLOCK[beat]} reduce={reduce} />
                        <ObjectCard open={open} beat={beat} stats={stats} outcome={outcome} onChoose={choose} onClose={() => setOpen(null)} onNext={afterOutcome} reduce={reduce} />
                        <AnimatePresence mode="wait">
                            {guideInfo && !open && (
                                <motion.button
                                    key={guideInfo.text}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.5 }}
                                    onClick={() => guideInfo.obj && unlocked.includes(guideInfo.obj) && openObj(guideInfo.obj)}
                                    disabled={!guideInfo.obj || !unlocked.includes(guideInfo.obj)}
                                    aria-label={guideInfo.obj ? `${guideInfo.text} Open ${OBJECTS[guideInfo.obj].label}.` : guideInfo.text}
                                    className="serif clear-badge"
                                    style={{ position: "absolute", left: "50%", bottom: 26, x: "-50%", zIndex: 6, maxWidth: "calc(100% - 32px)", padding: "8px 18px", borderRadius: 999, background: "rgba(12,10,12,.55)", backdropFilter: "blur(6px)", color: TEXT, fontSize: "clamp(20px, 2.4vw, 28px)", fontStyle: "italic", lineHeight: 1.2, textShadow: "0 2px 20px rgba(0,0,0,.8)", display: "flex", alignItems: "center", gap: 10, cursor: guideInfo.obj ? "pointer" : "default" }}
                                >
                                    <span aria-hidden="true" style={{ display: "flex", gap: 3, opacity: 0.7 }}>
                                        <span style={{ width: 5, height: 5, borderRadius: 9, background: TEXT }} />
                                        <span style={{ width: 7, height: 7, borderRadius: 9, background: TEXT }} />
                                    </span>
                                    {guideInfo.text}
                                    {guideInfo.obj && unlocked.includes(guideInfo.obj) && (
                                        <span className="px" style={{ fontStyle: "normal", fontSize: 17, padding: "0 8px", borderRadius: 6, background: BLUE, color: "#fff", textTransform: "uppercase" }}>
                                            {OBJECTS[guideInfo.obj].label}
                                        </span>
                                    )}
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                {phase === "watched" && (
                    <motion.div key="watched" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} style={{ position: "absolute", inset: 0 }}>
                        <WatchedOverlay step={watchStep} picks={picks} liked={likedComment} watchers={watchers} reduce={reduce} onNext={() => setPhase("toStudent")} />
                    </motion.div>
                )}

                {phase === "yourpost" && (
                    <motion.div key="yourpost" initial={startAt === "yourpost" ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} style={{ position: "absolute", inset: 0 }}>
                        <YourPostPOV profile={prof} likedId={(liked || "c1") as CommentId} reduce={reduce} still={startAt === "yourpost"} onDone={() => setPhase("toViewer")} />
                    </motion.div>
                )}

                {phase === "notify" && (
                    <motion.div key="notify" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} style={{ position: "absolute", inset: 0 }}>
                        <motion.button
                            onClick={() => setPhase("yourmove")}
                            initial={{ y: reduce ? 0 : -120, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: reduce ? 0 : 1.8, type: "spring", stiffness: 260, damping: 24 }}
                            className="glass"
                            aria-label={`Someone liked a comment on your post: ${YOUR_COMMENTS[prof.team][(liked || "c1") as CommentId]}. Open.`}
                            style={{ position: "absolute", top: 70, left: "50%", x: "-50%", width: "min(420px, calc(100% - 32px))", display: "flex", gap: 12, alignItems: "center", padding: 12, textAlign: "left", background: "rgba(28,30,38,.9)", borderRadius: 20, zIndex: 5 }}
                        >
                            <span style={{ width: 40, height: 40, borderRadius: 10, background: BLUE, display: "grid", placeItems: "center", flexShrink: 0 }}>
                                <Bitmap map={EYE} size={24} color="#fff" />
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#a8abb6" }}>
                                    <span>THE OTHER SIDE</span>
                                    <span>now</span>
                                </span>
                                <span style={{ display: "block", fontWeight: 700, fontSize: 15, marginTop: 2 }}>Someone liked a comment on your post</span>
                                <span style={{ display: "block", fontSize: 14, color: "#d4d6de", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    ♥ “{YOUR_COMMENTS[prof.team][(liked || "c1") as CommentId]}”
                                </span>
                            </span>
                        </motion.button>
                    </motion.div>
                )}

                {phase === "yourmove" && (
                    <motion.div key="yourmove" initial={{ opacity: 0, scale: reduce ? 1 : 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduce ? 1 : 0.92 }} transition={{ duration: 0.45 }} style={{ position: "absolute", inset: 0 }}>
                        <div className="phone">
                            <YourMove profile={prof} likedId={(liked || "c1") as CommentId} handle={storyHandle} caption={caption} reduce={reduce} onFinish={finishMove} />
                        </div>
                    </motion.div>
                )}

                {phase === "ending" && (
                    <motion.div key="ending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} style={{ position: "absolute", inset: 0 }}>
                        <Ending step={endStep} onReplay={replayAll} handle={prof.name} reduce={reduce} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/* ───────────────────────── Loader: a hand, a phone, in dots ───────────────────────── */

/* a wall of pixel eyes: they fill the screen, wander, blink — then all look at you */

const EYE_W = 92
const EYE_H = 54
const PX = 7 // dot pitch
const HALF_W = [5, 4, 2] // half-width of the almond for row |dy| = 0, 1, 2

const LOAD_CURVE: [number, number][] = [
    [0, 0],
    [330, 7],
    [700, 12],
    [920, 31],
    [1500, 34],
    [1800, 58],
    [2300, 61],
    [2500, 79],
    [2950, 83],
    [3250, 96],
    [3500, 100],
]
function curveAt(t: number) {
    for (let i = 1; i < LOAD_CURVE.length; i++) {
        const [t1, p1] = LOAD_CURVE[i]
        const [t0, p0] = LOAD_CURVE[i - 1]
        if (t <= t1) {
            const k = (t - t0) / (t1 - t0)
            const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
            return Math.round(p0 + (p1 - p0) * e)
        }
    }
    return 100
}

const PixelEye = memo(function PixelEye(props: { x: number; y: number; opened: boolean; lidMax: number; gx: number; gy: number; stare: boolean; blinkEvery: number; blink: boolean }) {
    const { x, y, opened, lidMax, gx, gy, stare, blinkEvery, blink } = props
    const [lid, setLid] = useState(0)
    // open in pixel steps when loading reaches this eye
    useEffect(() => {
        if (!opened) return
        const a = window.setTimeout(() => setLid(1), 60)
        const b = window.setTimeout(() => setLid(2), 140)
        return () => {
            window.clearTimeout(a)
            window.clearTimeout(b)
        }
    }, [opened])
    // its own blink
    useEffect(() => {
        if (!opened || !blink) return
        const ts: number[] = []
        const iv = window.setInterval(() => {
            ts.push(window.setTimeout(() => setLid(1), 0), window.setTimeout(() => setLid(0), 60), window.setTimeout(() => setLid(1), 130), window.setTimeout(() => setLid(2), 200))
        }, blinkEvery)
        return () => {
            window.clearInterval(iv)
            ts.forEach((t) => window.clearTimeout(t))
            setLid(2) // a blink cut off mid-way must not leave the lid shut
        }
    }, [opened, blink, blinkEvery])
    if (!opened) return null
    const L = Math.min(lid, lidMax)
    const ir = stare ? 2.1 : 1.6
    const dots: ReactNode[] = []
    for (let dy = -2; dy <= 2; dy++) {
        if (Math.abs(dy) > L) continue
        const hw = HALF_W[Math.abs(dy)]
        for (let dx = -hw; dx <= hw; dx++) {
            const ix = dx - gx
            const iy = dy - gy
            const d = Math.hypot(ix, iy)
            let fill = "#7d8498"
            if (L > 0 && ix === -1 && iy === -1) fill = "#ffffff"
            else if (L > 0 && d < 0.5) fill = INK
            else if (L > 0 && d <= ir) fill = stare ? BLUE : BLUE_GLOW
            else if (L === 0) fill = "#9aa1b4"
            dots.push(<circle key={`${dx}:${dy}`} cx={dx * PX} cy={dy * PX} r={PX * 0.42} fill={fill} />)
        }
    }
    return <g transform={`translate(${x} ${y})`}>{dots}</g>
})

function Loader(props: { onDone: () => void; reduce: boolean }) {
    const { onDone, reduce } = props
    const ref = useRef<HTMLDivElement>(null)
    const box = useBox(ref)
    const [pct, setPct] = useState(0)
    // 0 loading · 1 eyes closing/closed · 2 eyes open, staring at you
    const [stage, setStage] = useState(0)
    const [lidMax, setLidMax] = useState(2)

    // A loader is atmosphere, not a gate. Framer can throttle nested timers in a published tab.
    useEffect(() => {
        const failSafe = window.setTimeout(props.onDone, reduce ? 1800 : 9000)
        return () => window.clearTimeout(failSafe)
    }, [props.onDone, reduce])

    const eyes = useMemo(() => {
        if (!box.ok) return []
        const cols = Math.ceil(box.w / EYE_W) + 1
        const rows = Math.ceil(box.h / EYE_H) + 1
        const out: { k: number; x: number; y: number; th: number; be: number }[] = []
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) {
                const x = c * EYE_W + (r % 2 ? EYE_W / 2 : 0) + EYE_W / 4
                const y = r * EYE_H + EYE_H / 2
                const diag = clamp((x / box.w + y / box.h) / 2, 0, 1)
                out.push({ k: r * cols + c, x, y, th: Math.min(99, diag * 92 + hash(r, c, 21) * 8), be: 2600 + Math.round(hash(r, c, 23) * 4200) })
            }
        return out
    }, [box.ok, box.w, box.h])

    // gaze snaps cell by cell
    const [gaze, setGaze] = useState<Record<number, [number, number]>>({})
    useEffect(() => {
        if (reduce || stage > 0 || eyes.length === 0) return
        const pick = (): [number, number] => [Math.round(Math.random() * 6 - 3), Math.round(Math.random() * 2 - 1)]
        setGaze(Object.fromEntries(eyes.map((e) => [e.k, pick()])))
        const iv = window.setInterval(() => {
            setGaze((g) => {
                const n = { ...g }
                eyes.forEach((e) => {
                    if (Math.random() < 0.15) n[e.k] = pick()
                })
                return n
            })
        }, 480)
        return () => window.clearInterval(iv)
    }, [eyes.length, stage, reduce])

    useEffect(() => {
        if (reduce) {
            setPct(100)
            setStage(2)
            const t = window.setTimeout(onDone, 1200)
            return () => window.clearTimeout(t)
        }
        const t0 = Date.now()
        const ts: number[] = []
        const at = (ms: number, f: () => void) => ts.push(window.setTimeout(f, ms))
        const iv = window.setInterval(() => {
            const p = curveAt(Date.now() - t0)
            setPct(p)
            if (p >= 100) {
                window.clearInterval(iv)
                at(300, () => setStage(1))
                at(300, () => setLidMax(1)) // close, slowly, in pixel steps
                at(750, () => setLidMax(0))
                at(1500, () => setStage(2)) // eyes shut, pupils move to center
                at(1550, () => setLidMax(1)) // open, slowly, on you
                at(2150, () => setLidMax(2))
                at(2150 + 2000, onDone) // hold the stare
            }
        }, 40)
        return () => {
            window.clearInterval(iv)
            ts.forEach((t) => window.clearTimeout(t))
        }
    }, [])

    return (
        <motion.div
            ref={ref}
            key="loader"
            initial={false}
            exit={{ opacity: 0, transition: { duration: 1.1, ease: [0.4, 0, 0.2, 1] } }}
            role="progressbar"
            aria-label="Loading"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ position: "absolute", inset: 0, zIndex: 40, background: NIGHT, overflow: "hidden", cursor: "default", userSelect: "none" }}
        >
            <svg aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block" }}>
                <defs>
                    <pattern id="tosCross" width="12" height="12" patternUnits="userSpaceOnUse">
                        <path d="M6 4.5v3M4.5 6h3" stroke="rgba(243,237,228,.13)" strokeWidth="1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#tosCross)" />
                {eyes.map((e) => {
                    const g = stage > 0 || reduce ? [0, 0] : gaze[e.k] || [0, 0]
                    return <PixelEye key={e.k} x={e.x} y={e.y} opened={reduce || pct >= e.th} lidMax={reduce ? 2 : lidMax} gx={g[0]} gy={g[1]} stare={stage === 2} blinkEvery={e.be} blink={!reduce && stage === 0} />
                })}
            </svg>
            <div style={{ position: "absolute", inset: 0, background: stage === 2 ? "radial-gradient(ellipse at center, transparent 30%, rgba(5,6,10,.6) 100%)" : "transparent", transition: "background 1s ease", pointerEvents: "none" }} />
            <div
                className="px"
                style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "flex", gap: 14, alignItems: "baseline", padding: "6px 16px", background: "rgba(10,11,16,.9)", borderRadius: 4, color: TEXT, fontSize: 24, textTransform: "uppercase", whiteSpace: "nowrap", opacity: stage > 0 ? 0 : 1, transition: "opacity .6s ease" }}
            >
                <span>The Other Side</span>
                <span style={{ color: BLUE_GLOW, minWidth: 52, textAlign: "right" }}>{pct}%</span>
            </div>
            <button
                type="button"
                onClick={props.onDone}
                style={{ position: "absolute", left: "50%", bottom: 28, transform: "translateX(-50%)", color: TEXT, background: "rgba(10,11,16,.72)", border: "1px solid rgba(243,237,228,.3)", borderRadius: 999, padding: "10px 16px", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer" }}
            >
                Skip intro loading
            </button>
        </motion.div>
    )
}

/* ───────────────────────── Intro ───────────────────────── */

function Intro(props: { step: number; onBegin: () => void; onOpen: () => void; handle: string; caption: string; reduce: boolean; onLens: (x: number, y: number) => void }) {
    const { step, onBegin, onOpen, handle, caption, reduce, onLens } = props
    const track = (e: RPointerEvent<HTMLButtonElement>) => {
        const r = e.currentTarget.getBoundingClientRect()
        onLens((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
    }
    useEffect(() => {
        if (step !== 2) return
        const t = window.setTimeout(onOpen, reduce ? 4000 : 4500)
        return () => window.clearTimeout(t)
    }, [step])
    return (
        <>
            <div style={{ position: "absolute", left: 20, top: 18, display: "flex", alignItems: "center", gap: 10, color: TEXT, pointerEvents: "none" }}>
                <Bitmap map={EYE} size={26} color={TEXT} />
                <span className="px" style={{ fontSize: 26, textTransform: "uppercase" }}>
                    The Other Side
                </span>
            </div>
            {step === 0 && (
                <button onClick={onBegin} onPointerMove={track} onPointerDown={track} aria-label="Begin: look inside the windows" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "8vh", cursor: "none" }}>
                    <span className="px blink" style={{ fontSize: 26, color: TEXT, textTransform: "uppercase", padding: "4px 14px", background: "rgba(10,12,18,.55)" }}>
                        [ click anywhere ]
                    </span>
                </button>
            )}
            <AnimatePresence>
                {step >= 2 && (
                    <motion.button
                        key="notif"
                        onClick={onOpen}
                        initial={{ y: reduce ? 0 : -120, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 24 }}
                        className="glass"
                        aria-label={`New post from @${handle}: ${caption}. Open.`}
                        style={{ position: "absolute", top: 18, left: "50%", x: "-50%", width: "min(420px, calc(100% - 32px))", display: "flex", gap: 12, alignItems: "center", padding: 12, textAlign: "left", background: "rgba(28,30,38,.86)", borderRadius: 20, zIndex: 5 }}
                    >
                        <span style={{ width: 40, height: 40, borderRadius: 10, background: BLUE, display: "grid", placeItems: "center", flexShrink: 0 }}>
                            <Bitmap map={EYE} size={24} color="#fff" />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#a8abb6" }}>
                                <span>THE OTHER SIDE</span>
                                <span>now</span>
                            </span>
                            <span style={{ display: "block", fontWeight: 700, fontSize: 15, marginTop: 2 }}>@{handle} just posted</span>
                            <span style={{ display: "block", fontSize: 14, color: "#d4d6de", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{caption}</span>
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>
        </>
    )
}

/* ───────────────────────── Post illustrations ───────────────────────── */

type ArtKind = "dropout" | "read" | "walked"

function PostArt(props: { kind: ArtKind }) {
    const { kind } = props
    const id = useId().replace(/[^a-zA-Z0-9]/g, "")
    if (kind === "dropout") {
        return (
            <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
                <defs>
                    <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#232a47" />
                        <stop offset=".55" stopColor="#7d5966" />
                        <stop offset="1" stopColor="#e3a274" />
                    </linearGradient>
                    <radialGradient id={`sun${id}`} cx=".5" cy=".5" r=".5">
                        <stop offset="0" stopColor="#ffd2a0" stopOpacity=".55" />
                        <stop offset="1" stopColor="#ffd2a0" stopOpacity="0" />
                    </radialGradient>
                </defs>
                <rect width="400" height="500" fill={`url(#sky${id})`} />
                <circle cx="310" cy="330" r="150" fill={`url(#sun${id})`} />
                {/* campus building */}
                <polygon points="30,142 200,72 370,142" fill="#cbbfa8" />
                <polygon points="60,138 200,84 340,138" fill="#b9ad95" />
                <rect x="40" y="142" width="320" height="30" fill="#c2b69e" />
                <text x="200" y="163" textAnchor="middle" fill="#6d6352" style={{ fontFamily: "Georgia, serif", fontSize: 17, letterSpacing: 7 }}>
                    UNIVERSITY
                </text>
                <rect x="50" y="172" width="300" height="160" fill="#9e9380" />
                {[0, 1, 2, 3, 4].map((i) => (
                    <rect key={`w${i}`} x={88 + i * 52} y={196} width="22" height="44" fill={i === 1 || i === 3 ? "#ffcf8a" : "#3a3240"} opacity=".85" />
                ))}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <g key={`c${i}`}>
                        <rect x={60 + i * 52} y="172" width="24" height="160" fill="#dcd1bc" />
                        <rect x={78 + i * 52} y="172" width="6" height="160" fill="#a3977f" opacity=".7" />
                    </g>
                ))}
                <rect x="180" y="250" width="40" height="82" fill="#1e1a20" />
                {[0, 1, 2, 3].map((i) => (
                    <rect key={`s${i}`} x={40 - i * 14} y={332 + i * 14} width={320 + i * 28} height="14" fill={["#8f8572", "#857b69", "#7a705f", "#6e6555"][i]} />
                ))}
                <rect y="388" width="400" height="112" fill="#3a3341" />
                <path d="M0 420 H400 M0 460 H400" stroke="#463e4e" strokeWidth="2" />
                {/* flying paper */}
                <g transform="rotate(-18 120 300)">
                    <rect x="98" y="278" width="46" height="58" fill="#f3ede2" />
                    <rect x="106" y="290" width="30" height="3" fill="#9e9586" />
                    <rect x="106" y="298" width="24" height="3" fill="#9e9586" />
                    <rect x="106" y="318" width="22" height="8" fill="none" stroke="#b5432f" strokeWidth="2" />
                </g>
                {/* student walking away */}
                <ellipse cx="292" cy="484" rx="80" ry="8" fill="#000" opacity=".35" />
                <circle cx="292" cy="328" r="16" fill="#141019" />
                <path d="M268 348 h48 l7 84 h-62 Z" fill="#141019" />
                <rect x="303" y="352" width="24" height="48" rx="7" fill="#5a2f2a" />
                <rect x="232" y="374" width="44" height="36" fill="#a87b4f" />
                <rect x="232" y="388" width="44" height="4" fill="#7d5a38" />
                <rect x="271" y="430" width="15" height="54" fill="#141019" />
                <rect x="299" y="426" width="15" height="54" fill="#141019" transform="rotate(8 306 430)" />
            </svg>
        )
    }
    if (kind === "read") {
        return (
            <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
                <rect width="400" height="500" fill="#14161d" />
                <rect x="110" y="60" width="180" height="360" rx="26" fill="#1d2130" stroke="#2f3546" strokeWidth="4" />
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <rect key={i} x={i % 2 ? 130 : 170} y={100 + i * 46} width={i % 2 ? 110 : 100} height="30" rx="14" fill={i % 2 ? "#3a4154" : "#2a3042"} />
                ))}
                <text x="276" y="398" textAnchor="end" fill="#6b7080" style={{ fontFamily: "Inter, sans-serif", fontSize: 12 }}>
                    Seen
                </text>
            </svg>
        )
    }
    return (
        <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
            <rect width="400" height="500" fill="#17131a" />
            <rect x="140" y="80" width="130" height="320" fill="#ffcf8a" />
            <polygon points="140,80 205,110 205,430 140,400" fill="#3b2a22" />
            <circle cx="236" cy="200" r="16" fill="#1a1216" />
            <path d="M216 222 h40 l6 120 h-52 Z" fill="#1a1216" />
            <rect x="262" y="320" width="34" height="46" rx="4" fill="#5a3a30" />
            <polygon points="140,400 270,400 360,500 40,500" fill="#ffcf8a" opacity=".18" />
        </svg>
    )
}

/* ───────────────────────── First-person: the phone goes down ───────────────────────── */

function PhonePOV(props: { lowered: boolean; liked: Comment | null; handle: string; caption: string; reduce: boolean; still?: boolean }) {
    const { lowered, liked, handle, caption, reduce, still } = props
    const ref = useRef<HTMLDivElement>(null)
    const box = useBox(ref)
    const scale = Math.max(box.w / 1600, box.h / 900)
    const sw = 1600 * scale
    const sh = 900 * scale
    const [likes, setLikes] = useState(18400)
    const [line, setLine] = useState(0)

    useEffect(() => {
        if (lowered) return
        const t = window.setInterval(() => setLikes((n) => n + 3 + Math.floor(Math.random() * 40)), 140)
        return () => window.clearInterval(t)
    }, [lowered])
    useEffect(() => {
        if (!lowered) return
        const a = window.setTimeout(() => setLine(1), reduce ? 0 : 1100)
        const b = window.setTimeout(() => setLine(2), reduce ? 0 : 2300)
        return () => {
            window.clearTimeout(a)
            window.clearTimeout(b)
        }
    }, [lowered, reduce])

    const skin = "#b9825f"
    const shade = "#8e5c40"

    return (
        <div ref={ref} style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#120d0f" }}>
            {/* the room behind the phone, out of focus until the phone goes down */}
            <div
                style={{
                    position: "absolute",
                    left: (box.w - sw) / 2,
                    top: (box.h - sh) / 2,
                    width: sw,
                    height: sh,
                    filter: lowered ? "blur(0px) brightness(1)" : "blur(10px) brightness(.4)",
                    transform: lowered ? "scale(1) translateY(0)" : "scale(1.1) translateY(5%)",
                    transition: reduce ? "none" : "filter 1.8s ease, transform 2s ease",
                }}
            >
                <RoomSVG beat={0} buzz={false} />
            </div>
            <div className="vignette" />
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                <div className="grain" />
            </div>

            {/* hand + phone */}
            <motion.div
                initial={still ? false : { y: reduce ? "0%" : "35%", rotate: -3, opacity: 0 }}
                animate={lowered ? { y: "135%", rotate: -16, opacity: 1 } : { y: "0%", rotate: -3, opacity: 1 }}
                transition={lowered ? { duration: reduce ? 0.01 : 1.1, ease: [0.5, 0, 0.75, 0] } : { duration: reduce ? 0.01 : 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                style={{ position: "absolute", left: "50%", bottom: "-4%", x: "-50%", width: "min(330px, 62vw)", aspectRatio: "9 / 18.5" }}
            >
                <div style={{ position: "absolute", inset: 0, borderRadius: 38, border: "9px solid #0a0a0d", background: NIGHT, overflow: "hidden", boxShadow: `0 0 90px rgba(110,123,255,.35)` }}>
                    <div style={{ padding: "14px 12px", color: TEXT }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <span style={{ width: 22, height: 22, borderRadius: 99, background: "rgba(255,255,255,.2)", border: "1.5px solid #fff" }} />
                            <span style={{ fontWeight: 700, fontSize: 12 }}>@{handle}</span>
                        </div>
                        <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 10, overflow: "hidden" }}>
                            <PostArt kind="dropout" />
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, margin: "8px 0 10px" }}>{caption}</p>
                        <div style={{ fontSize: 11, color: "#9a9da8", fontWeight: 700, marginBottom: 6 }}>{fmt(likes)} comments</div>
                        <div style={{ height: 230, overflow: "hidden", position: "relative" }}>
                            <motion.div animate={reduce ? {} : { y: [0, -260] }} transition={{ duration: 7, ease: "linear" }}>
                                {POV_STREAM.map((c, i) => (
                                    <div key={i} style={{ display: "flex", gap: 8, padding: "6px 4px" }}>
                                        <span style={{ width: 18, height: 18, borderRadius: 99, background: `hsl(${210 + i * 17} 8% ${28 + (i % 4) * 8}%)`, flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 10, color: "#9a9da8" }}>@{c.h}</div>
                                            <div style={{ fontSize: 12 }}>{c.t}</div>
                                        </div>
                                        <span style={{ color: "#6c6f7a", fontSize: 9, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            <Icon name="heart" size={11} />
                                            {fmt(c.n)}
                                        </span>
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    </div>
                </div>
                <svg viewBox="0 0 520 300" aria-hidden="true" style={{ position: "absolute", left: "-30%", width: "160%", top: "55%", height: "70%", overflow: "visible" }} preserveAspectRatio="none">
                    <path d="M40 300 C50 262 110 244 200 247 L360 247 C430 250 480 270 492 300 Z" fill="#2a2230" />
                    <path d="M72 290 C60 226 92 170 152 160 L382 150 C442 152 470 202 468 290 Z" fill={skin} />
                    <path d="M152 160 L382 150" stroke={shade} strokeWidth="3" opacity=".5" />
                    <path d="M86 252 C70 200 80 150 106 116 C120 98 142 102 144 122 C146 142 130 172 128 212 Z" fill={skin} stroke={shade} strokeWidth="3" />
                    {[0, 1, 2].map((i) => (
                        <rect key={i} x="406" y={72 + i * 42} width="54" height="36" rx="18" fill={skin} stroke={shade} strokeWidth="3" />
                    ))}
                </svg>
            </motion.div>

            {/* inner thought */}
            <div aria-live="polite" style={{ position: "absolute", left: 0, right: 0, top: "34%", textAlign: "center", padding: "0 24px", pointerEvents: "none" }}>
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: line >= 1 ? 1 : 0, y: line >= 1 ? 0 : 8 }} transition={{ duration: 0.9 }} className="serif" style={{ margin: 0, fontStyle: "italic", fontSize: "clamp(32px, 4.6vw, 56px)", lineHeight: 1.05, color: TEXT, textShadow: "0 2px 30px rgba(0,0,0,.8)" }}>
                    You don’t even know me.
                </motion.p>
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: line >= 2 ? 0.8 : 0, y: line >= 2 ? 0 : 8 }} transition={{ duration: 0.9 }} className="serif" style={{ margin: "10px 0 0", fontStyle: "italic", fontSize: "clamp(22px, 3vw, 34px)", color: TEXT, textShadow: "0 2px 30px rgba(0,0,0,.8)" }}>
                    …and you’ve already decided.
                </motion.p>
            </div>
        </div>
    )
}

/* ───────────────────────── Shared: a hand holding a phone (first person) ───────────────────────── */

function HandPhone(props: { children: ReactNode; lowered?: boolean; still?: boolean; reduce: boolean }) {
    const { children, lowered = false, still, reduce } = props
    const skin = "#b9825f"
    const shade = "#8e5c40"
    return (
        <motion.div
            initial={still ? false : { y: reduce ? "0%" : "35%", rotate: -3, opacity: 0 }}
            animate={lowered ? { y: "135%", rotate: -16, opacity: 1 } : { y: "0%", rotate: -3, opacity: 1 }}
            transition={lowered ? { duration: reduce ? 0.01 : 1.1, ease: [0.5, 0, 0.75, 0] } : { duration: reduce ? 0.01 : 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ position: "absolute", left: "50%", bottom: "-4%", x: "-50%", width: "min(330px, 62vw)", aspectRatio: "9 / 18.5" }}
        >
            <div style={{ position: "absolute", inset: 0, borderRadius: 38, border: "9px solid #0a0a0d", background: NIGHT, overflow: "hidden", boxShadow: `0 0 90px rgba(110,123,255,.35)` }}>{children}</div>
            <svg viewBox="0 0 520 300" aria-hidden="true" style={{ position: "absolute", left: "-30%", width: "160%", top: "55%", height: "70%", overflow: "visible" }} preserveAspectRatio="none">
                <path d="M40 300 C50 262 110 244 200 247 L360 247 C430 250 480 270 492 300 Z" fill="#2a2230" />
                <path d="M72 290 C60 226 92 170 152 160 L382 150 C442 152 470 202 468 290 Z" fill={skin} />
                <path d="M152 160 L382 150" stroke={shade} strokeWidth="3" opacity=".5" />
                <path d="M86 252 C70 200 80 150 106 116 C120 98 142 102 144 122 C146 142 130 172 128 212 Z" fill={skin} stroke={shade} strokeWidth="3" />
                {[0, 1, 2].map((i) => (
                    <rect key={i} x="406" y={72 + i * 42} width="54" height="36" rx="18" fill={skin} stroke={shade} strokeWidth="3" />
                ))}
            </svg>
        </motion.div>
    )
}

/* the room behind the phone, out of focus */
function BlurredRoom(props: { beat: number; sharp?: boolean; reduce: boolean }) {
    const { beat, sharp, reduce } = props
    const ref = useRef<HTMLDivElement>(null)
    const box = useBox(ref)
    const scale = Math.max(box.w / 1600, box.h / 900)
    const sw = 1600 * scale
    const sh = 900 * scale
    return (
        <div ref={ref} style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#120d0f" }}>
            <div style={{ position: "absolute", left: (box.w - sw) / 2, top: (box.h - sh) / 2, width: sw, height: sh, filter: sharp ? "none" : "blur(10px) brightness(.4)", transform: sharp ? "none" : "scale(1.1) translateY(5%)", transition: reduce ? "none" : "filter 1.8s ease, transform 2s ease" }}>
                <RoomSVG beat={beat} buzz={false} />
            </div>
            <div className="vignette" />
        </div>
    )
}

/* a comment row, the way every app draws one */
function CommentRow(props: { handle: string; text: string; count: number; liked?: boolean; pop?: boolean; size?: "s" | "m"; onHeart?: () => void; heartLabel?: string; note?: string; pulse?: boolean; glow?: boolean; dim?: boolean; bump?: boolean; reduce?: boolean }) {
    const { handle, text, count, liked, pop, size = "s", onHeart, heartLabel, note, pulse, glow, dim, bump, reduce } = props
    const fs = size === "s" ? 12 : 14
    const heart = (
        <motion.span animate={(pop || bump) && !reduce ? { scale: [1, 1.7, 1] } : pulse && !reduce ? { scale: [1, 1.18, 1] } : { scale: 1 }} transition={pulse && !pop ? { duration: 1.2, repeat: Infinity } : { duration: 0.45 }} style={{ display: "grid", color: liked || bump ? BLUE_GLOW : "#7c7f8a", transition: "color .4s" }}>
            <Icon name="heart" size={size === "s" ? 13 : 18} fill={!!liked} />
        </motion.span>
    )
    return (
        <motion.div
            initial={false}
            animate={glow && !reduce ? { boxShadow: ["0 0 10px rgba(110,123,255,.12)", "0 0 26px rgba(110,123,255,.32)"] } : { boxShadow: "0 0 0px rgba(110,123,255,0)" }}
            transition={glow ? { duration: 2.4, repeat: Infinity, repeatType: "reverse" } : { duration: 0.4 }}
            style={{ display: "flex", gap: 8, padding: size === "s" ? "6px 6px" : "8px 8px", alignItems: "flex-start", borderRadius: 12, background: glow ? "rgba(51,70,255,.14)" : "transparent", opacity: dim ? 0.32 : 1, transition: "opacity .7s ease, background .7s ease" }}
        >
            <span aria-hidden="true" style={{ width: size === "s" ? 18 : 26, height: size === "s" ? 18 : 26, borderRadius: 99, background: "rgba(255,255,255,.14)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: fs - 2, color: "#9a9da8" }}>@{handle}</div>
                <div style={{ fontSize: fs, lineHeight: 1.3 }}>{text}</div>
                {note && <div style={{ fontSize: fs - 3, color: BLUE_GLOW, marginTop: 2, fontWeight: 600 }}>{note}</div>}
            </div>
            {onHeart ? (
                <button onClick={onHeart} aria-pressed={!!liked} aria-label={heartLabel} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44, minHeight: 44, justifyContent: "center", fontSize: fs - 3, color: "#9a9da8" }}>
                    {heart}
                    {fmt(count)}
                </button>
            ) : (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: fs - 3, color: "#9a9da8", minWidth: 28 }}>
                    {heart}
                    <span style={{ position: "relative", display: "inline-block", minWidth: 24, textAlign: "center" }}>
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span key={count} initial={reduce ? false : { y: 10, opacity: 0, scale: 1.5 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.45 }} style={{ display: "inline-block", color: bump ? BLUE_GLOW : undefined, fontWeight: bump ? 700 : undefined }}>
                                {fmt(count)}
                            </motion.span>
                        </AnimatePresence>
                        <AnimatePresence>
                            {bump && !reduce && (
                                <motion.span key="plus" initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 1, 0], y: -26 }} transition={{ duration: 1.6, times: [0, 0.15, 0.7, 1] }} style={{ position: "absolute", left: "50%", top: -6, x: "-50%", color: BLUE_GLOW, fontWeight: 800, fontSize: fs, pointerEvents: "none" }}>
                                    +1
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </span>
                </span>
            )}
        </motion.div>
    )
}

/* your post: a group-project table at night, a little out of context */
function TeamArt(props: { comfort: string }) {
    const id = useId().replace(/[^a-zA-Z0-9]/g, "")
    return (
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
            <defs>
                <radialGradient id={`lamp${id}`} cx=".5" cy=".3" r=".7">
                    <stop offset="0" stopColor="#ffd9a6" stopOpacity=".55" />
                    <stop offset="1" stopColor="#ffd9a6" stopOpacity="0" />
                </radialGradient>
            </defs>
            <rect width="400" height="300" fill="#2a2430" />
            <rect width="400" height="300" fill={`url(#lamp${id})`} />
            <rect x="0" y="0" width="400" height="120" fill="#332b38" />
            <rect x="40" y="26" width="120" height="70" rx="4" fill="#efe7d8" opacity=".9" />
            <text x="100" y="56" textAnchor="middle" fill="#6b5f52" style={{ fontFamily: "Georgia, serif", fontSize: 13 }}>
                FINAL PROJECT
            </text>
            <text x="100" y="76" textAnchor="middle" fill="#9a8f80" style={{ fontFamily: "Georgia, serif", fontSize: 10 }}>
                due Friday
            </text>
            <polygon points="20,190 380,190 400,300 0,300" fill="#6d4a33" />
            <polygon points="20,190 380,190 382,198 18,198" fill="#8a6142" />
            {[60, 150, 250, 330].map((x, i) => (
                <g key={i}>
                    <rect x={x - 18} y={140} width="36" height="52" rx="8" fill={i === 2 ? "#3a3240" : "#1c1820"} />
                    {i !== 2 && <circle cx={x} cy={128} r="14" fill="#1c1820" />}
                </g>
            ))}
            <rect x="232" y="150" width="36" height="20" rx="6" fill="#5a3a30" opacity=".8" />
            <rect x="150" y="200" width="100" height="58" rx="4" fill="#1b1e28" />
            <rect x="156" y="206" width="88" height="44" rx="2" fill="#4c5bff" opacity=".85" />
            <rect x="250" y="216" width="70" height="40" fill="#f6d77a" transform="rotate(6 285 236)" />
            <text x="285" y="240" textAnchor="middle" fill="#5b4a1e" transform="rotate(6 285 236)" style={{ fontFamily: "Georgia, serif", fontSize: 9, fontStyle: "italic" }}>
                {props.comfort.length > 14 ? props.comfort.slice(0, 13) + "…" : props.comfort}?
            </text>
            <rect x="80" y="210" width="44" height="30" rx="3" fill="#e9e2d4" transform="rotate(-8 102 225)" />
        </svg>
    )
}

function YourPostCard(props: { profile: Profile; likedId: CommentId; studentLiked: boolean; showHeart?: boolean; glowLiked?: boolean; focus?: "post" | "comment" | null; pop?: boolean; size?: "s" | "m"; reduce: boolean }) {
    const { profile, likedId, studentLiked, showHeart = true, glowLiked, focus = null, pop, size = "s", reduce } = props
    const postRing: CSSProperties = { borderRadius: 12, padding: 6, margin: -6, border: `1px solid ${focus === "post" ? "rgba(110,123,255,.7)" : "transparent"}`, boxShadow: focus === "post" ? "0 0 26px rgba(110,123,255,.35)" : "none", opacity: focus === "comment" ? 0.4 : 1, transition: "all .7s ease" }
    const ids: CommentId[] = ["c3", "c1", "c4", "c2"]
    return (
        <div>
            <div style={postRing}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: size === "s" ? 22 : 28, height: size === "s" ? 22 : 28, borderRadius: 99, background: BLUE, display: "grid", placeItems: "center" }}>
                    <Bitmap map={EYE} size={size === "s" ? 13 : 16} color="#fff" />
                </span>
                <span style={{ fontWeight: 700, fontSize: size === "s" ? 12 : 14 }}>@{profile.name}</span>
            </div>
            <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 10, overflow: "hidden" }}>
                <TeamArt comfort={profile.comfort} />
            </div>
            <p style={{ fontSize: size === "s" ? 12 : 14, fontWeight: 600, margin: "8px 0 8px" }}>
                <span style={{ color: "#9a9da8" }}>@{profile.name}</span> {YOUR_CAPTION[profile.team]}
            </p>
            </div>
            <div style={{ opacity: focus === "post" ? 0.35 : 1, transition: "opacity .7s ease" }}>
                {ids.map((cid) => (
                    <CommentRow key={cid} handle={YOUR_HANDLES[cid]} text={YOUR_COMMENTS[profile.team][cid]} count={YOUR_COUNTS[cid] + (cid === likedId && studentLiked ? 1 : 0)} liked={showHeart && cid === likedId && studentLiked} pop={showHeart && cid === likedId && pop} glow={(glowLiked || focus === "comment") && cid === likedId} dim={(glowLiked || focus === "comment") && cid !== likedId} bump={!showHeart && studentLiked && cid === likedId} size={size} reduce={reduce} />
                ))}
            </div>
        </div>
    )
}

/* ───────────────────────── Act 0: who are you (a sign-up, nothing more) ───────────────────────── */

function ProfileSetup(props: { initial: Profile | null; onDone: (p: Profile) => void; reduce: boolean }) {
    const { initial, onDone, reduce } = props
    const [step, setStep] = useState(0)
    const [name, setName] = useState("")
    const [idea] = useState(() => NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)])
    const [team, setTeam] = useState<TeamChoice | null>(null)
    const [comfort, setComfort] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (step === 0) window.setTimeout(() => inputRef.current?.focus(), 400)
    }, [step])
    const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 18)
    const finish = (t: TeamChoice) => onDone({ name: clean(name) || idea, team: t, comfort: comfort || COMFORTS[0] })
    // a casual sign-up: who you are → what you like → one small "what if"
    const titles = ["Pick a username", "Tell us about you. What do you like?", "Group project. One teammate did nothing. What would you do?"]
    return (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "22px 18px 18px", color: TEXT }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Bitmap map={EYE} size={22} color={TEXT} />
                    <span className="px" style={{ fontSize: 22, textTransform: "uppercase" }}>
                        The Other Side
                    </span>
                </div>
                <ol aria-label={`Step ${step + 1} of 3`} style={{ display: "flex", gap: 5, listStyle: "none", margin: 0, padding: 0 }}>
                    {[0, 1, 2].map((i) => (
                        <li key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 9, background: i <= step ? BLUE_GLOW : "rgba(255,255,255,.2)", transition: "all .3s" }} />
                    ))}
                </ol>
            </div>
            <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step} initial={{ opacity: 0, x: reduce ? 0 : 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduce ? 0 : -24 }} transition={{ duration: 0.3 }} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, margin: "0 0 22px", letterSpacing: "-0.02em" }}>{titles[step]}</h2>
                    {step === 0 && (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                setStep(1)
                            }}
                            style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}
                        >
                            <span aria-hidden="true" style={{ width: 84, height: 84, borderRadius: 99, background: "rgba(110,123,255,.18)", border: `2px dashed ${BLUE_GLOW}`, display: "grid", placeItems: "center", alignSelf: "center" }}>
                                <Bitmap map={EYE} size={40} color={BLUE_GLOW} />
                            </span>
                            <label style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 14px", borderRadius: 12, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)", height: 52 }}>
                                <span style={{ color: "#9a9da8", fontSize: 17 }}>@</span>
                                <span style={srOnly}>Nickname</span>
                                <input ref={inputRef} value={name} placeholder={idea} onChange={(e) => setName(clean(e.target.value))} maxLength={18} autoComplete="off" style={{ flex: 1, background: "transparent", border: 0, outline: "none", color: TEXT, fontSize: 17, fontFamily: "inherit" }} />
                            </label>
                            <div style={{ flex: 1 }} />
                            <button type="submit" className="btn" style={{ width: "100%" }}>
                                Next
                            </button>
                        </form>
                    )}
                    {step === 1 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                            {COMFORTS.map((c) => (
                                <button key={c} onClick={() => {
                                        setComfort(c)
                                        window.setTimeout(() => setStep(2), reduce ? 0 : 180)
                                    }} className="ghost" aria-pressed={comfort === c} style={{ background: comfort === c ? "rgba(110,123,255,.2)" : undefined, borderColor: comfort === c ? BLUE_GLOW : undefined, borderRadius: 999, minHeight: 46, padding: "8px 16px" }}>
                                    {c}
                                </button>
                            ))}
                        </div>
                    )}
                    {step === 2 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {TEAM_OPTIONS.map((o) => (
                                <button
                                    key={o.id}
                                    onClick={() => {
                                        setTeam(o.id)
                                        window.setTimeout(() => finish(o.id), reduce ? 0 : 180)
                                    }}
                                    className="ghost"
                                    aria-pressed={team === o.id}
                                    style={{ justifyContent: "flex-start", textAlign: "left", width: "100%", minHeight: 54, borderRadius: 12, background: team === o.id ? "rgba(110,123,255,.2)" : undefined, borderColor: team === o.id ? BLUE_GLOW : undefined }}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
            <p style={{ margin: "16px 0 0", fontSize: 11, color: "#8d909b", textAlign: "center" }}>Stays on this device. Nothing is sent.</p>
        </div>
    )
}

/* ───────────────────────── Act 4: the student picks the phone back up ───────────────────────── */

function YourPostPOV(props: { profile: Profile; likedId: CommentId; reduce: boolean; still?: boolean; onDone: () => void }) {
    const { profile, likedId, reduce, still, onDone } = props
    const [step, setStep] = useState(still ? 4 : 0) // 0 scrolling · 1 stops on your post · 2 reads the post · 3 reads that comment · 4 like lands
    useEffect(() => {
        if (still) return
        const seq = reduce ? [300, 900, 1800, 2700, 4600] : [2600, 4300, 7300, 10300, 13800]
        const ts = seq.map((ms, i) => window.setTimeout(() => (i < 4 ? setStep(i + 1) : onDone()), ms))
        return () => ts.forEach((t) => window.clearTimeout(t))
    }, [still, reduce])
    return (
        <div style={{ position: "absolute", inset: 0 }}>
            <BlurredRoom beat={3} reduce={reduce} />
            <HandPhone still={still} reduce={reduce}>
                <div style={{ height: "100%", overflow: "hidden", position: "relative" }}>
                    <motion.div initial={still ? false : { y: 0 }} animate={{ y: step >= 3 ? -400 : step >= 1 ? -300 : 0 }} transition={{ duration: reduce ? 0.01 : 2.2, ease: [0.3, 0, 0.2, 1] }} style={{ padding: "14px 12px", color: TEXT }}>
                        {/* someone else's post scrolls past first */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ width: 22, height: 22, borderRadius: 99, background: "rgba(255,255,255,.2)" }} />
                            <span style={{ fontWeight: 700, fontSize: 12 }}>@exhibit_002</span>
                        </div>
                        <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
                            <PostArt kind="read" />
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 24px" }}>left everyone on read for 3 months</p>
                        <YourPostCard profile={profile} likedId={likedId} studentLiked={step >= 4} pop={step >= 4} reduce={reduce} />
                    </motion.div>
                </div>
            </HandPhone>
        </div>
    )
}

/* ───────────────────────── Act 5: your phone, your move ───────────────────────── */

function YourMove(props: { profile: Profile; likedId: CommentId; handle: string; caption: string; reduce: boolean; onFinish: (r: { unliked: boolean; text: string | null }) => void }) {
    const { profile, likedId, handle, caption, reduce, onFinish } = props
    const liked = COMMENTS.find((c) => c.id === likedId) || COMMENTS[0]
    const [unliked, setUnliked] = useState(false)
    const [compose, setCompose] = useState(false)
    const [draft, setDraft] = useState("")
    const [hintOn, setHintOn] = useState(false)
    const [landed, setLanded] = useState(false)
    useEffect(() => {
        const t = window.setTimeout(() => setLanded(true), reduce ? 0 : 1100)
        return () => window.clearTimeout(t)
    }, [reduce])
    const taRef = useRef<HTMLTextAreaElement>(null)
    useEffect(() => {
        const t = window.setTimeout(() => setHintOn(true), reduce ? 0 : 3500)
        return () => window.clearTimeout(t)
    }, [reduce])
    useEffect(() => {
        if (compose) window.setTimeout(() => taRef.current?.focus(), 350)
    }, [compose])
    const toggle = () => {
        if (unliked) {
            setUnliked(false)
            setCompose(false)
            return
        }
        setUnliked(true)
        window.setTimeout(() => setCompose(true), reduce ? 0 : 450)
    }
    return (
        <div style={{ position: "absolute", inset: 0, color: TEXT }}>
            <div className="scroll" style={{ position: "absolute", inset: 0, padding: "16px 14px 96px" }}>
                <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px 14px" }}>
                    <Bitmap map={EYE} size={22} color={TEXT} />
                    <span className="px" style={{ fontSize: 22, textTransform: "uppercase" }}>
                        The Other Side
                    </span>
                </header>
                <div style={{ borderRadius: 16, background: "#171a22", padding: 12, marginBottom: 14, border: "1px solid rgba(255,255,255,.06)" }}>
                    <YourPostCard profile={profile} likedId={likedId} studentLiked={landed} showHeart={false} glowLiked={landed} size="m" reduce={reduce} />
                </div>
                <div style={{ borderRadius: 16, background: "#171a22", padding: 12, border: "1px solid rgba(255,255,255,.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 99, background: "rgba(255,255,255,.2)", border: "1.5px solid #fff" }} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>@{handle}</span>
                    </div>
                    <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 10, overflow: "hidden" }}>
                        <PostArt kind="dropout" />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: "8px 0" }}>{caption}</p>
                    <CommentRow
                        handle={liked.handle}
                        text={liked.text}
                        count={liked.likes + (unliked ? 0 : 1)}
                        liked={!unliked}
                        size="m"
                        onHeart={toggle}
                        heartLabel={unliked ? `Like again: ${liked.text}` : `Unlike: ${liked.text}`}
                        note={unliked ? undefined : "Liked by you"}
                        pulse={hintOn && !unliked}
                        reduce={reduce}
                    />
                </div>
            </div>
            {/* bottom bar */}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 14px 16px", background: "linear-gradient(180deg, rgba(16,19,26,0), rgba(16,19,26,.95) 30%)", display: "flex", justifyContent: "center" }}>
                {!compose && (
                    <button className="ghost" onClick={() => onFinish({ unliked, text: null })} style={{ minWidth: 140, borderRadius: 999 }}>
                        Done
                    </button>
                )}
            </div>
            {/* composer: only after you take the like back */}
            <AnimatePresence>
                {compose && (
                    <motion.div key="compose" initial={{ y: reduce ? 0 : "100%", opacity: reduce ? 0 : 1 }} animate={{ y: 0, opacity: 1 }} exit={{ y: reduce ? 0 : "100%", opacity: reduce ? 0 : 1 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#1b1e27", borderRadius: "20px 20px 0 0", padding: "16px 16px 18px", borderTop: "1px solid rgba(255,255,255,.08)", zIndex: 5 }}>
                        <div className="serif" aria-hidden="true" style={{ display: "flex", gap: 12, flexWrap: "wrap", fontStyle: "italic", fontSize: 19, marginBottom: 10, color: "#d8d2c8" }}>
                            <span>is it true?</span>
                            <span style={{ color: BLUE_GLOW }}>is it kind?</span>
                            <span>is it necessary?</span>
                        </div>
                        <label htmlFor="tos-reply" style={srOnly}>
                            Write a comment on @{handle}’s post
                        </label>
                        <textarea
                            id="tos-reply"
                            ref={taRef}
                            value={draft}
                            maxLength={140}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder={`Add a comment for @${handle}…`}
                            rows={3}
                            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.06)", color: TEXT, fontSize: 16, lineHeight: 1.35, resize: "none", fontFamily: "inherit" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 10 }}>
                            <button className="ghost" onClick={() => onFinish({ unliked: true, text: null })} style={{ borderRadius: 999 }}>
                                Skip
                            </button>
                            <button className="btn" disabled={!draft.trim()} onClick={() => onFinish({ unliked: true, text: draft.trim() })} style={{ borderRadius: 999, opacity: draft.trim() ? 1 : 0.5 }}>
                                Post <Icon name="send" size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/* ───────────────────────── Ending: two windows, nothing more ───────────────────────── */

function Ending(props: { step: number; onReplay: () => void; handle: string; reduce: boolean }) {
    const { step, onReplay, reduce } = props
    const d = reduce ? 0.01 : 1
    return (
        <div aria-live="polite" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <AnimatePresence>
                {step >= 1 && step < 3 && (
                    <motion.div key="line" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.9 * d } }} transition={{ duration: 0.9 * d }} style={{ position: "absolute", left: 0, right: 0, bottom: "14%", textAlign: "center", padding: "0 20px" }}>
                        <p className="serif" style={{ margin: 0, fontStyle: "italic", fontSize: "clamp(30px, 4.4vw, 54px)", lineHeight: 1.05, color: TEXT, textShadow: "0 2px 30px rgba(0,0,0,.9)" }}>
                            Everyone is more than the moment you saw.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* outro: the building goes dark, then the title card */}
            <motion.div initial={false} animate={{ opacity: step >= 2 ? 1 : 0 }} transition={{ duration: 1.4 * d }} style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 55%, rgba(16,19,26,.55), #07080b 75%)" }} />
            <AnimatePresence>
                {step >= 3 && (
                    <motion.div key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4 * d }} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "0 24px", textAlign: "center", color: TEXT }}>
                        <motion.div initial={{ scale: reduce ? 1 : 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.2 * d }}>
                            <Bitmap map={EYE} size={56} color={BLUE_GLOW} />
                        </motion.div>
                        <h2 className="px" style={{ margin: 0, fontSize: "clamp(40px, 7vw, 84px)", lineHeight: 0.9, textTransform: "uppercase", fontWeight: 400, letterSpacing: ".02em" }}>
                            The Other Side
                        </h2>
                        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 * d, duration: 0.6 * d }} onClick={onReplay} className="ghost" style={{ marginTop: 14, pointerEvents: "auto", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <Icon name="replay" size={18} /> Play again
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/* ───────────────────────── Top bar ───────────────────────── */

function TopBar(props: { progress: number; onBack: () => void; onSkip?: () => void }) {
    const { progress, onBack, onSkip } = props
    const names = ["Watch", "Live", "Watched", "Watching you", "Your side"]
    const box: CSSProperties = { width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", color: TEXT, background: "rgba(12,12,16,.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.12)", pointerEvents: "auto" }
    return (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", pointerEvents: "none" }}>
            <button onClick={onBack} aria-label="Back to feed" style={box}>
                <Icon name="back" />
            </button>
            <ol aria-label="Progress" style={{ display: "flex", gap: 8, listStyle: "none", margin: 0, padding: "6px 12px", alignItems: "center", borderRadius: 999, background: "rgba(12,12,16,.55)", backdropFilter: "blur(8px)" }}>
                {names.map((n, i) => (
                    <li key={n} aria-current={i === progress ? "step" : undefined} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ display: "block", width: 8, height: 8, borderRadius: 2, background: i === progress ? BLUE_GLOW : i < progress ? TEXT : "rgba(243,237,228,.25)" }} />
                        {i === progress ? (
                            <span className="px" style={{ color: TEXT, fontSize: 19, textTransform: "uppercase" }}>
                                {n}
                            </span>
                        ) : (
                            <span style={srOnly}>{n}</span>
                        )}
                    </li>
                ))}
            </ol>
            <div style={{ width: 44, height: 44 }}>
                {onSkip && (
                    <button onClick={onSkip} aria-label="Skip" style={box}>
                        <Icon name="skip" size={18} />
                    </button>
                )}
            </div>
        </div>
    )
}

/* ───────────────────────── Feed (inside the phone) ───────────────────────── */

function Feed(props: { handle: string; caption: string; storyLiked: boolean; onStoryLike: () => void; onComments: () => void; done: boolean; onReplay: () => void }) {
    const { handle, caption, storyLiked, onStoryLike, onComments, done } = props
    return (
        <div className="scroll" style={{ position: "absolute", inset: 0, background: NIGHT }}>
            <div style={{ padding: "16px 14px 40px" }}>
                <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 4px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Bitmap map={EYE} size={24} color={TEXT} />
                        <span className="px" style={{ fontSize: 24, textTransform: "uppercase" }}>
                            The Other Side
                        </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, borderBottom: `2px solid ${BLUE_GLOW}`, paddingBottom: 2 }}>For you</span>
                </header>


                <StoryCard art="dropout" handle={handle} caption={caption} likes={2100000 + (storyLiked ? 1 : 0)} comments={18400} liked={storyLiked} onLike={onStoryLike} onComments={onComments} badge={done ? "Seen the other side" : undefined} />
                <StoryCard art="read" handle="exhibit_002" caption="left everyone on read for 3 months" likes={984000} comments={7200} locked />
                <StoryCard art="walked" handle="exhibit_003" caption="she just walked out??" likes={1400000} comments={12900} locked />
            </div>
        </div>
    )
}

function StoryCard(props: { art: ArtKind; handle: string; caption: string; likes: number; comments: number; liked?: boolean; onLike?: () => void; onComments?: () => void; locked?: boolean; badge?: string }) {
    const { art, handle, caption, likes, comments, liked, onLike, onComments, locked, badge } = props
    return (
        <article aria-label={`Post by ${handle}`} style={{ position: "relative", aspectRatio: "4 / 5", overflow: "hidden", marginBottom: 14, borderRadius: 16, background: "#000" }}>
            <div style={{ position: "absolute", inset: 0, filter: locked ? "grayscale(.7) blur(3px) brightness(.6)" : undefined }}>
                <PostArt kind={art} />
            </div>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 55%, rgba(0,0,0,.75) 100%)" }} />
            <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
                <span style={{ width: 28, height: 28, borderRadius: 99, background: "rgba(255,255,255,.18)", border: "1.5px solid #fff" }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>@{handle}</span>
            </div>
            {!locked && (
                <span className="px" style={{ position: "absolute", top: 14, right: 14, color: "#fff", fontSize: 18, display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="blink" style={{ width: 8, height: 8, borderRadius: 99, background: "#ff4b4b" }} /> REC 00:10
                </span>
            )}
            {badge && (
                <span style={{ position: "absolute", top: 48, right: 12, background: BLUE, color: "#fff", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>{badge}</span>
            )}
            {locked && (
                <span className="px" style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,.5)", color: "#fff", padding: "2px 10px", borderRadius: 999, fontSize: 18, display: "flex", gap: 6, alignItems: "center" }}>
                    <Icon name="lock" size={13} /> SOON
                </span>
            )}
            <p style={{ position: "absolute", left: 14, right: 76, bottom: 16, margin: 0, color: "#fff", fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{caption}</p>
            {!locked && (
                <div style={{ position: "absolute", right: 10, bottom: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                    <button className="rail-btn" onClick={onLike} aria-pressed={!!liked} aria-label={liked ? "Unlike post" : "Like post"}>
                        <motion.span className="ic" animate={liked ? { scale: [1, 1.2, 1] } : { scale: 1 }} style={{ color: liked ? BLUE_GLOW : "#fff" }}>
                            <Icon name="heart" fill={!!liked} />
                        </motion.span>
                        {fmt(likes)}
                    </button>
                    <button className="rail-btn" onClick={onComments} aria-label={`Open ${fmt(comments)} comments`}>
                        <span className="ic">
                            <Icon name="comment" />
                        </span>
                        {fmt(comments)}
                    </button>
                    <span className="rail-btn" aria-hidden="true">
                        <span className="ic">
                            <Icon name="share" />
                        </span>
                        Share
                    </span>
                </div>
            )}
        </article>
    )
}

function Drawer(props: { open: boolean; onClose: () => void; liked: string | null; onLike: (id: string) => void; showCoach: boolean; mine: string | null; reduce: boolean }) {
    const { open, onClose, liked, onLike, showCoach, mine, reduce } = props
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 10 }} />
                    <motion.section
                        key="sheet"
                        role="dialog"
                        aria-label="Comments"
                        initial={{ y: reduce ? 0 : "100%", opacity: reduce ? 0 : 1 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: reduce ? 0 : "100%", opacity: reduce ? 0 : 1 }}
                        transition={{ type: "spring", damping: 32, stiffness: 320 }}
                        style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "78%", background: "#171a22", borderRadius: "20px 20px 0 0", zIndex: 11, display: "flex", flexDirection: "column", borderTop: "1px solid rgba(255,255,255,.08)" }}
                    >
                        <div style={{ width: 36, height: 4, borderRadius: 4, background: "rgba(255,255,255,.25)", margin: "8px auto 0" }} />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 4px 18px" }}>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>18.4K comments</span>
                            <button onClick={onClose} aria-label="Close comments" style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 99 }}>
                                <Icon name="x" size={18} />
                            </button>
                        </div>
                        {!mine && (
                            <div style={{ margin: "2px 12px 8px", padding: "12px 14px", borderRadius: 14, background: "rgba(51,70,255,.14)", border: `1px solid rgba(110,123,255,.45)` }}>
                                <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>Which comment do you agree with?</div>
                                <div style={{ fontSize: 13, color: "#c5c8d6", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: BLUE_GLOW, display: "grid" }}>
                                        <Icon name="heart" size={14} fill />
                                    </span>
                                    Like just one.
                                </div>
                            </div>
                        )}
                        <div className="scroll" style={{ padding: "0 6px 24px" }}>
                            {mine && (
                                <div style={{ display: "flex", gap: 12, padding: 12, margin: "0 6px 6px", borderRadius: 14, background: "rgba(51,70,255,.16)", border: `1px solid ${BLUE}` }}>
                                    <span style={{ width: 34, height: 34, borderRadius: 99, background: BLUE, flexShrink: 0, display: "grid", placeItems: "center" }}>
                                        <Bitmap map={EYE} size={20} color="#fff" />
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: BLUE_GLOW }}>you · after</div>
                                        <p style={{ margin: "3px 0 0", fontSize: 15, lineHeight: 1.35 }}>{mine}</p>
                                    </div>
                                </div>
                            )}
                            {COMMENTS.map((c, i) => {
                                const isLiked = liked === c.id
                                return (
                                    <div key={c.id} style={{ position: "relative", display: "flex", gap: 12, padding: 12, alignItems: "flex-start" }}>
                                        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 99, background: `hsl(${220 + i * 25} 10% ${30 + i * 6}%)`, flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "#9a9da8" }}>@{c.handle}</div>
                                            <p style={{ margin: "3px 0 0", fontSize: 15, lineHeight: 1.35 }}>{c.text}</p>
                                        </div>
                                        <button className="cmt-heart" onClick={() => onLike(c.id)} aria-pressed={isLiked} aria-label={`Like: ${c.text}`} style={{ color: isLiked ? BLUE_GLOW : !liked && !mine ? "#c5c8d6" : undefined }}>
                                            <motion.span animate={isLiked && !reduce ? { scale: [1, 1.5, 1] } : !liked && !mine && !reduce && showCoach ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.35 }} style={{ display: "grid" }}>
                                                <Icon name="heart" size={20} fill={isLiked} />
                                            </motion.span>
                                            {fmt(c.likes + (isLiked ? 1 : 0))}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </motion.section>
                </>
            )}
        </AnimatePresence>
    )
}

/* ───────────────────────── Room ───────────────────────── */

function Room(props: { beat: number; visited: ObjId[]; target: ObjId | null; hint: ObjId | null; onOpen: (id: ObjId) => void; reduce: boolean; flash: string | null; pops: boolean; unlocked: ObjId[]; picks: Option[]; blocked: boolean }) {
    const { beat, visited, target, hint, onOpen, reduce, pops, unlocked, picks, blocked } = props
    const wrapRef = useRef<HTMLDivElement>(null)
    const box = useBox(wrapRef)
    const [player, setPlayer] = useState({ x: 800, y: 800, heading: 0 })
    const playerRef = useRef(player)
    const [camera, setCamera] = useState({ x: 0, y: 0 })
    const cameraRef = useRef(camera)
    const [paused, setPaused] = useState(false)
    const [locked, setLocked] = useState(false)
    const held = useRef(new Set<string>())
    const drag = useRef<{ x: number; y: number; cameraX: number; cameraY: number } | null>(null)
    const active = !blocked && !paused

    const scale = Math.max(box.w / 1600, box.h / 900)
    const sw = 1600 * scale
    const sh = 900 * scale
    const zoom = 1.12
    const maxX = Math.max(0, (sw * zoom - box.w) / 2)
    const maxY = Math.max(0, (sh * zoom - box.h) / 2)

    const collides = (x: number, y: number) => {
        if (x < 42 || x > 1558 || y < 640 || y > 872) return true
        const radius = 28
        const obstacles = [
            [0, 0, 590, 740],      // bed
            [0, 625, 430, 900],    // foreground chair
            [675, 585, 795, 742],  // backpack
            [780, 525, 1420, 746], // desk and drawers
        ]
        return obstacles.some(([l, t, r, b]) => x + radius > l && x - radius < r && y + radius > t && y - radius < b)
    }

    const nearest = () => {
        const p = playerRef.current
        return (Object.keys(OBJECTS) as ObjId[])
            .filter(id => unlocked.includes(id) || visited.includes(id))
            .map(id => ({ id, d: Math.hypot(p.x - OBJECTS[id].x / 100 * 1600, p.y - OBJECTS[id].y / 100 * 900) }))
            .sort((a, b) => a.d - b.d)[0]
    }
    const interactNearby = () => {
        const n = nearest()
        if (n && n.d < 490) onOpen(n.id)
    }

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code.startsWith("Arrow")) e.preventDefault()
            if (e.code === "Escape") {
                if (blocked) return
                held.current.clear()
                if (document.pointerLockElement) document.exitPointerLock?.()
                setPaused(true)
                return
            }
            if (e.code === "KeyE") {
                if (!blocked && !paused) { e.preventDefault(); interactNearby() }
                return
            }
            if (e.code.startsWith("Arrow") && !blocked && !paused) held.current.add(e.code)
        }
        const onKeyUp = (e: KeyboardEvent) => { if (e.code.startsWith("Arrow")) { e.preventDefault(); held.current.delete(e.code) } }
        const onBlur = () => held.current.clear()
        const onLock = () => setLocked(document.pointerLockElement === wrapRef.current)
        window.addEventListener("keydown", onKeyDown)
        window.addEventListener("keyup", onKeyUp)
        window.addEventListener("blur", onBlur)
        document.addEventListener("pointerlockchange", onLock)
        return () => {
            window.removeEventListener("keydown", onKeyDown)
            window.removeEventListener("keyup", onKeyUp)
            window.removeEventListener("blur", onBlur)
            document.removeEventListener("pointerlockchange", onLock)
            held.current.clear()
        }
    }, [blocked, paused])

    useEffect(() => {
        if (!active) { held.current.clear(); return }
        let frame = 0
        let last = 0
        const tick = (time: number) => {
            const dt = last ? Math.min((time - last) / 1000, .04) : 0
            last = time
            const keys = held.current
            let forward = (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0)
            let strafe = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0)
            const len = Math.hypot(forward, strafe) || 1
            forward /= len; strafe /= len
            if (forward || strafe) {
                const p = playerRef.current
                const speed = 235 * dt
                const dx = (Math.sin(p.heading) * forward + Math.cos(p.heading) * strafe) * speed
                const dy = (-Math.cos(p.heading) * forward + Math.sin(p.heading) * strafe) * speed
                let nx = p.x, ny = p.y
                if (!collides(p.x + dx, p.y)) nx += dx
                if (!collides(nx, p.y + dy)) ny += dy
                if (nx !== p.x || ny !== p.y) {
                    const next = { ...p, x: nx, y: ny }
                    playerRef.current = next
                    setPlayer(next)
                    const c = cameraRef.current
                    const nextCamera = { x: clamp(c.x - (nx - p.x) * scale * .78, -maxX, maxX), y: clamp(c.y - (ny - p.y) * scale * .55, -maxY, maxY) }
                    cameraRef.current = nextCamera
                    setCamera(nextCamera)
                }
            }
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [active, scale, maxX, maxY])

    useEffect(() => {
        if (!locked || !active) return
        const onMouse = (e: MouseEvent) => {
            const p = playerRef.current
            const next = { ...p, heading: p.heading + e.movementX * .0028 }
            playerRef.current = next
            setPlayer(next)
            const c = cameraRef.current
            const nextCamera = { x: clamp(c.x - e.movementX * .58, -maxX, maxX), y: clamp(c.y - e.movementY * .5, -maxY, maxY) }
            cameraRef.current = nextCamera
            setCamera(nextCamera)
        }
        document.addEventListener("mousemove", onMouse)
        return () => document.removeEventListener("mousemove", onMouse)
    }, [locked, active, maxX, maxY])

    const onSceneClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const targetEl = e.target as HTMLElement
        if (targetEl.closest("button") || blocked || paused) return
        if (document.pointerLockElement) { interactNearby(); return }
        if (!document.pointerLockElement) {
            try { wrapRef.current?.requestPointerLock?.() } catch {}
        }
    }
    const onMove = (e: RPointerEvent) => {
        if (!drag.current || e.pointerType === "mouse") return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        const c = { x: clamp(drag.current.cameraX + dx, -maxX, maxX), y: clamp(drag.current.cameraY + dy, -maxY, maxY) }
        cameraRef.current = c
        setCamera(c)
    }

    const nearby = (Object.keys(OBJECTS) as ObjId[]).filter(id => Math.hypot(player.x - OBJECTS[id].x / 100 * 1600, player.y - OBJECTS[id].y / 100 * 900) < 490)
    const dust = useMemo(() => Array.from({ length: 16 }).map((_, i) => ({ l: 20 + hash(i, 1, 7) * 70, t: 30 + hash(i, 2, 7) * 60, d: hash(i, 3, 7) * 9 })), [])

    return (
        <div ref={wrapRef} onClick={onSceneClick} onPointerMove={onMove}
            onPointerDown={e => { if (e.pointerType !== "mouse") drag.current = { x:e.clientX, y:e.clientY, cameraX:camera.x, cameraY:camera.y } }}
            onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
            style={{ position:"absolute", inset:0, overflow:"hidden", background:"#120d0f", touchAction:"none", cursor:locked ? "none" : "crosshair" }}>
            <motion.div animate={{ x:camera.x, y:camera.y, scale:zoom }} transition={{ type:"tween", ease:"linear", duration:.12 }}
                style={{ position:"absolute", left:(box.w-sw)/2, top:(box.h-sh)/2, width:sw, height:sh, transformOrigin:"center center" }}>
                <RoomSVG beat={beat} buzz={nearby.includes("phone")} />
                {/* the phone won't stop: Mom, strangers, then the boss */}
                {pops && (
                    <div aria-live="polite" style={{ position: "absolute", left: `${OBJECTS.phone.x}%`, top: `${OBJECTS.phone.y - 6}%`, width: 0, height: 0, zIndex: 4, pointerEvents: "none" }}>
                        {PHONE_POPS.map((m, i) => {
                            const last = i === PHONE_POPS.length - 1
                            const style: CSSProperties =
                                m.who === "mom"
                                    ? { background: "#F3E7D3", color: "#2a1a12" }
                                    : m.who === "boss"
                                      ? { background: "#fff", color: INK, boxShadow: `0 0 0 2px ${BLUE}, 0 0 30px rgba(51,70,255,.6)` }
                                      : { background: "rgba(16,18,26,.88)", color: "#fff", border: "1px solid rgba(110,123,255,.5)" }
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10, scale: 0.85 }}
                                    animate={last ? { opacity: 1, y: -70, scale: 1 } : { opacity: [0, 1, 1, 0], y: [10, -40, -90, -140], scale: [0.85, 1, 1, 1] }}
                                    transition={last ? { delay: reduce ? 0 : 4.2, duration: 0.5 } : { delay: reduce ? 0 : 0.4 + i * 0.7, duration: reduce ? 0.01 : 3.2, times: [0, 0.15, 0.7, 1] }}
                                    style={{ position: "absolute", left: (i % 2 ? 12 : -12) - 120, bottom: 0, width: 240, display: "flex", justifyContent: "center" }}
                                >
                                    <span style={{ ...style, padding: "7px 12px", borderRadius: 14, fontSize: 14, fontWeight: 600, lineHeight: 1.25, boxShadow: style.boxShadow || "0 8px 20px rgba(0,0,0,.4)", maxWidth: 240 }}>{m.t}</span>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
                {(Object.keys(OBJECTS) as ObjId[]).filter(id => unlocked.includes(id) || visited.includes(id)).map(id => {
                    const o = OBJECTS[id]
                    const focused = target === id || hint === id
                    return <button key={id} className={`hot${focused ? " target" : ""}${nearby.includes(id) ? " nearby" : ""}`} aria-label={`Inspect ${o.label}`} onClick={e => { e.stopPropagation(); if (!drag.current) onOpen(id) }}
                        style={{ left:o.x+"%", top:o.y+"%", transform:"translate(-50%,-50%)", zIndex:3 }}>
                        <span className="ring" /><span className="dot" /><span className="lbl">{o.label}{nearby.includes(id) ? " · E" : ""}</span>
                    </button>
                })}
            </motion.div>
            <div className="vignette" /><div className="grain" />
            <ScreenAudience picks={picks} reduce={reduce} />
            <div className="px" style={{position:"absolute",left:14,bottom:12,zIndex:6,padding:"4px 10px",borderRadius:8,background:"rgba(12,10,12,.5)",color:"rgba(243,237,228,.75)",fontSize:18,pointerEvents:"none"}}>
                ↑↓ MOVE · ←→ STRAFE · E INSPECT · CLICK TO LOOK · ESC PAUSE
            </div>
            {paused && <div role="dialog" aria-label="Experience paused" style={{position:"absolute",inset:0,zIndex:15,display:"grid",placeItems:"center",background:"rgba(8,9,14,.5)",backdropFilter:"blur(4px)"}}>
                <div style={{textAlign:"center",padding:24,background:"rgba(16,19,26,.94)",border:"1px solid rgba(255,255,255,.18)",borderRadius:16,color:TEXT}}>
                    <div className="px" style={{fontSize:28,marginBottom:12}}>PAUSED</div>
                    <button className="btn" onClick={() => setPaused(false)}>Resume exploring</button>
                    <div style={{fontSize:12,opacity:.65,marginTop:12}}>Arrow keys move · E inspects</div>
                </div>
            </div>}
        </div>
    )
}

function WatchedOverlay({step,picks,liked,watchers,reduce,onNext}: {step:number; picks:Option[]; liked:Comment|null; watchers:number; reduce:boolean; onNext:()=>void}) {
    return <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
        <ScreenAudience picks={picks} reduce={reduce} />
        <div className="px" style={{position:"absolute",top:80,left:"50%",transform:"translateX(-50%)",fontSize:24,background:NIGHT,padding:"6px 14px",whiteSpace:"nowrap"}}>LIVE · {fmt(1204331 + watchers * 18240)} WATCHING</div>
        {step >= 3 && step < 5 && <div style={{position:"absolute",left:"50%",top:126,transform:"translateX(-50%)",display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",width:"min(520px,calc(100% - 32px))",zIndex:6}}>
            {[{label:"supportive",color:"#9ed7b1"},{label:"critical",color:"#ff9d8e"},{label:"uncertain",color:"#b8c3e8"}].map(tone => <span key={tone.label} style={{padding:"5px 10px",borderRadius:999,border:`1px solid ${tone.color}66`,color:tone.color,background:"rgba(10,12,18,.68)",fontSize:11,letterSpacing:".12em",textTransform:"uppercase"}}>{tone.label} voices</span>)}
        </div>}
        {step >= 5 && <button className="btn" onClick={onNext} style={{position:"absolute",bottom:28,left:"50%",transform:"translateX(-50%)",pointerEvents:"auto",zIndex:12}}>Continue <Icon name="next" size={18}/></button>}
    </div>
}

function Bar({v}: {v:number}) {
 return <span style={{width:60,height:6,background:"rgba(255,255,255,.15)",borderRadius:99,overflow:"hidden",display:"inline-block"}}><span style={{display:"block",height:"100%",width:v+"%",background:TEXT}} /></span>
}
function Hud({stats,clock}: {stats:Stats;clock:string;reduce:boolean}) {
 const chip:CSSProperties={display:"inline-flex",alignItems:"center",gap:8,background:"rgba(14,11,13,.8)",border:"1px solid rgba(255,235,210,.12)",borderRadius:10,padding:"0 12px",fontSize:21,height:36};
 return <div role="status" className="px" style={{position:"absolute",top:70,left:16,zIndex:5,display:"flex",flexWrap:"wrap",gap:8,maxWidth:"calc(100% - 32px)"}}>
 <span style={chip}>{clock}</span><span style={chip}>RENT <span style={{color:stats.money<640?AMBER:TEXT}}>${stats.money}</span>/640</span><span style={chip}>EXAM FRI 9AM</span><span style={chip}>ENERGY <Bar v={stats.energy}/></span><span style={chip}>GRADES <Bar v={stats.grade}/></span></div>
}

/* ───────────────────────── Object card ───────────────────────── */

function Delta(props: { d: Partial<Stats> }) {
    const items: { k: string; v: number; icon: string }[] = []
    if (props.d.money) items.push({ k: "money", v: props.d.money, icon: "$" })
    if (props.d.energy) items.push({ k: "energy", v: props.d.energy, icon: "⚡" })
    if (props.d.grade) items.push({ k: "grade", v: props.d.grade, icon: "A+" })
    return (
        <div className="px" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {items.map((it) => (
                <span key={it.k} style={{ fontSize: 21, padding: "0 10px", borderRadius: 8, background: it.v > 0 ? "rgba(255,255,255,.12)" : "rgba(255,140,90,.16)", color: it.v > 0 ? TEXT : "#FFB08A" }}>
                    {it.icon} {it.v > 0 ? "+" : "−"}
                    {Math.abs(it.v)}
                </span>
            ))}
        </div>
    )
}

function ObjectCard(props: { open: ObjId | null; beat: number; stats: Stats; outcome: Option | null; onChoose: (o: Option) => void; onClose: () => void; onNext: () => void; reduce: boolean }) {
    const { open, beat, stats, outcome, onChoose, onClose, onNext, reduce } = props
    const isBeat = open !== null && beat < 3 && BEATS[beat].obj === open
    const firstRef = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        if (!open) return
        const t = window.setTimeout(() => firstRef.current?.focus(), 30)
        return () => window.clearTimeout(t)
    }, [open, outcome])
    useEffect(() => {
        if (!outcome) return
        const t = window.setTimeout(onNext, reduce ? 3400 : 2800)
        return () => window.clearTimeout(t)
    }, [outcome])

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key={open + String(beat)}
                    role="dialog"
                    aria-labelledby="tos-card-title"
                    initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduce ? 0 : 16 }}
                    transition={{ duration: 0.25 }}
                    className="glass clear-badge"
                    style={{ position: "absolute", left: "50%", bottom: 22, x: "-50%", width: "min(560px, calc(100% - 32px))", zIndex: 8, padding: 20, color: TEXT }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span id="tos-card-title" className="px" style={{ fontSize: 19, letterSpacing: ".1em", opacity: 0.7, textTransform: "uppercase" }}>
                            {OBJECTS[open].label}
                        </span>
                    </div>
                    {outcome ? (
                        <div>
                            <p style={{ margin: "0 0 14px", fontSize: 21, fontWeight: 700, lineHeight: 1.3 }}>{outcome.out}</p>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                <Delta d={outcome.d} />
                                <button ref={firstRef} onClick={onNext} aria-label="Continue" className="btn" style={{ width: 48, padding: 0, borderRadius: 99, flexShrink: 0 }}>
                                    <Icon name="next" size={18} />
                                </button>
                            </div>
                        </div>
                    ) : isBeat ? (
                        <div>
                            <p style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>{BEATS[beat].prompt(stats)}</p>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {BEATS[beat].options.map((o, i) => (
                                    <button key={o.id} ref={i === 0 ? firstRef : undefined} className="ghost" onClick={() => onChoose(o)}>
                                        {o.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
                            <p style={{ margin: 0, fontSize: 21, fontWeight: 600, lineHeight: 1.35 }}>{OBJECTS[open].info}</p>
                            <button ref={firstRef} onClick={onClose} aria-label="Continue" className="btn" style={{ width: 48, padding: 0, borderRadius: 99, flexShrink: 0 }}>
                                <Icon name="next" size={18} />
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}





addPropertyControls(TheOtherSide, {
    storyHandle: { type: ControlType.String, title: "Handle", defaultValue: "room017" },
    caption: { type: ControlType.String, title: "Caption", defaultValue: "dropped out at 20 lol 💀 #college" },
    startAt: { type: ControlType.Enum, title: "Start at", options: ["intro", "profile", "feed", "pov", "room", "yourpost", "yourmove"], optionTitles: ["Intro", "Profile", "Feed", "Phone POV", "Room", "Your post", "Your move"], defaultValue: "intro", description: "Preview only. Keep on Intro for the live site." },
})
/* Audience surrounds the viewport, independently of the room camera. */
function ScreenAudience({ picks, reduce }: { picks: Option[]; reduce: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const box = useBox(ref)
    const narrow = box.w < 700
    const count = picks.length * (narrow ? 8 : 16)
    const perEdge = Math.max(1, Math.ceil(count / 4))
    const figureHeight = (narrow ? 62 : 86) * (perEdge <= 4 ? 1 : perEdge <= 8 ? .78 : .62)
    const figureWidth = figureHeight * .58
    const positions: CSSProperties[] = narrow
        ? [{ left: 8, top: "23%" }, { right: 8, top: "43%" }, { left: 8, bottom: 86 }]
        : [{ left: 58, top: "22%" }, { right: 58, top: "40%" }, { right: 58, bottom: 88 }]
    const poses = [
        <><path d="M15 24Q22 19 29 24L32 48H12Z"/><path d="M15 28L7 43M29 28L37 19L40 10M17 47L13 84M27 47L32 84"/></>,
        <><path d="M15 24Q22 19 29 24L32 48H12Z"/><path d="M15 28L6 13L11 6M29 28L38 13L33 6M17 47L10 84M27 47L34 84"/></>,
        <><path d="M14 25Q22 18 30 25L33 49H11Z"/><path d="M14 29L4 36L10 44M30 29L39 39L43 35M17 48L14 84M27 48L31 84"/></>,
        <><path d="M13 24Q22 19 31 24L36 50L8 50Z"/><path d="M14 29L5 41M30 29L39 41M16 49L12 84M28 49L32 84"/></>,
        <><path d="M15 24Q22 19 29 24L32 48H12Z"/><path d="M15 28L7 36L14 40M29 28L37 36L30 40M17 47L13 84M27 47L32 84"/></>,
        <><path d="M15 25Q22 19 29 25L32 47H12Z"/><path d="M15 29L7 18L11 12M29 29L37 37L42 32M17 47L10 78M27 47L37 77"/></>,
    ]
    return (
        <div ref={ref} aria-label={count + " people watching"} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 7, overflow: "hidden" }}>
            {Array.from({ length: count }, (_, i) => {
                const edge = i % 4
                const slot = Math.floor(i / 4)
                const pct = 5 + slot / Math.max(1, perEdge - 1) * 90
                const side = edge === 1 || edge === 3
                const angle = edge === 0 ? "180deg" : edge === 1 ? "-90deg" : edge === 3 ? "90deg" : "0deg"
                const inward = edge === 0
                    ? { left: pct + "%", top: -figureHeight * .25 }
                    : edge === 1
                      ? { right: -figureHeight * .25, top: (17 + slot / perEdge * 66) + "%" }
                      : edge === 2
                        ? { left: pct + "%", bottom: -figureHeight * .22 }
                        : { left: -figureHeight * .25, top: (17 + slot / perEdge * 66) + "%" }
                return <motion.div key={i} initial={{ opacity: 0, scale: .82 }} animate={{ opacity: .96, scale: 1 }} transition={{ delay: reduce ? 0 : (i % 16) * .07, type: "spring", stiffness: 300, damping: 22 }}
                    style={{ position: "absolute", ...inward, width: side ? figureHeight : figureWidth, height: side ? figureWidth : figureHeight, transformOrigin: "center", filter: "drop-shadow(0 0 7px rgba(110,123,255,.28)) drop-shadow(0 2px 3px rgba(0,0,0,.8))" }}>
                    <svg viewBox="0 0 44 90" aria-hidden="true" style={{ position:"absolute", left:"50%", top:"50%", width:figureWidth, height:figureHeight, transform:"translate(-50%,-50%) rotate(" + angle + ")", transformOrigin:"center", overflow:"visible" }}>
                        <g fill="#08090d" stroke="#0a0b10" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="22" cy="13" r="8" stroke="rgba(110,123,255,.5)" strokeWidth="1.2"/>
                            {poses[i % poses.length]}
                        </g>
                    </svg>
                </motion.div>
            })}
            <AnimatePresence>
                {picks.map((p, i) => <motion.div key={p.id} initial={{ opacity: 0, scale: reduce ? 1 : .85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .35 }} style={{ position: "absolute", ...positions[i], width: narrow ? "min(190px, 48%)" : "min(250px, 24%)", background: NIGHT, border: "1px solid " + BLUE_GLOW, boxShadow: "4px 4px 0 rgba(0,0,0,.6), 0 0 24px rgba(51,70,255,.25)", color: TEXT }}>
                    <div className="px" style={{ background: BLUE, padding: "3px 10px", fontSize: narrow ? 14 : 18 }}>@{CROWD[i].h} · just now</div>
                    <div style={{ padding: narrow ? "8px 10px" : "12px 14px", fontSize: narrow ? 12 : 15, lineHeight: 1.3, fontWeight: 600 }}>{p.outside}</div>
                </motion.div>)}
            </AnimatePresence>
        </div>
    )
}


