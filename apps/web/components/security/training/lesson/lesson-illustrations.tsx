"use client"

import type { ReactNode } from "react"
import {
  AlarmClock,
  AlertTriangle,
  BookUser,
  Bug,
  Check,
  CheckCircle2,
  Crown,
  HandHelping,
  Lock,
  PhoneCall,
  PhoneOff,
  Search,
  ShieldAlert,
  Star,
  VenetianMask,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { LessonIllustration } from "@/lib/security/training-lesson"
import { TrainingBot } from "./training-bot"

// ============================================================================
// SHARED PRIMITIVES
// ============================================================================

const palette = {
  wall: "#e7edf6",
  wallShade: "#d6dfec",
  floor: "#c3cfe0",
  desk: "#a47148",
  deskTop: "#c08a5b",
  ink: "#1e293b",
}

const people = {
  sophie: { skin: "#c68863", hair: "#1f2937", shirt: "#0ea5e9", hairStyle: "long" as const },
  attacker: { skin: "#e0ac8a", hair: "#334155", shirt: "#334155", hairStyle: "hood" as const },
  stranger: { skin: "#f1c27d", hair: "#7c2d12", shirt: "#ca8a04", hairStyle: "cap" as const },
  itDesk: { skin: "#8d5524", hair: "#111827", shirt: "#16a34a", hairStyle: "short" as const },
  colleague: { skin: "#f1c27d", hair: "#92400e", shirt: "#8b5cf6", hairStyle: "short" as const },
}

/** Fade (and optionally rise) an SVG group in when `on` */
function fade(on: boolean, rise = true) {
  return cn(
    "transition-[opacity,translate] duration-700 ease-out",
    on ? "opacity-100 translate-y-0" : cn("opacity-0", rise && "translate-y-[12px]")
  )
}

interface PersonProps {
  x: number
  y: number
  scale?: number
  skin: string
  hair: string
  shirt: string
  hairStyle: "short" | "long" | "cap" | "hood"
  flip?: boolean
  pose?: "stand" | "point" | "phone" | "carry" | "thumbs" | "give"
  mood?: "neutral" | "happy" | "worried" | "sly"
  className?: string
}

/** A simple flat-style character, feet at (x, y), about 150 units tall at scale 1 */
function Person({ x, y, scale = 1, skin, hair, shirt, hairStyle, flip, pose = "stand", mood = "neutral", className }: PersonProps) {
  const mouth = {
    neutral: <path d="M-5 -118 h10" stroke={palette.ink} strokeWidth="2" strokeLinecap="round" />,
    happy: <path d="M-6 -120 q6 6 12 0" stroke={palette.ink} strokeWidth="2" fill="none" strokeLinecap="round" />,
    worried: <path d="M-6 -116 q6 -5 12 0" stroke={palette.ink} strokeWidth="2" fill="none" strokeLinecap="round" />,
    sly: <path d="M-6 -119 q8 4 12 -3" stroke={palette.ink} strokeWidth="2" fill="none" strokeLinecap="round" />,
  }[mood]

  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} className={className}>
      {/* Legs and shoes */}
      <rect x="-17" y="-56" width="14" height="54" rx="6" fill="#334155" />
      <rect x="3" y="-56" width="14" height="54" rx="6" fill="#334155" />
      <ellipse cx="-10" cy="-2" rx="11" ry="5" fill="#0f172a" />
      <ellipse cx="10" cy="-2" rx="11" ry="5" fill="#0f172a" />

      {/* Back arm */}
      {pose !== "carry" && <rect x="-31" y="-104" width="11" height="46" rx="5.5" fill={shirt} />}

      {/* Torso */}
      <rect x="-23" y="-110" width="46" height="60" rx="15" fill={shirt} />
      {hairStyle === "hood" && <path d="M-23 -96 q23 -22 46 0" fill="none" stroke="#1e293b" strokeWidth="3" />}

      {/* Front arm by pose */}
      {pose === "stand" && <rect x="20" y="-104" width="11" height="46" rx="5.5" fill={shirt} />}
      {pose === "point" && (
        <g transform="rotate(-78 25 -100)">
          <rect x="20" y="-104" width="11" height="52" rx="5.5" fill={shirt} />
          <circle cx="25.5" cy="-50" r="6" fill={skin} />
        </g>
      )}
      {pose === "phone" && (
        <g>
          <rect x="16" y="-140" width="11" height="40" rx="5.5" fill={shirt} transform="rotate(-20 21 -104)" />
          <rect x="8" y="-142" width="9" height="18" rx="2" fill="#0f172a" />
        </g>
      )}
      {pose === "thumbs" && (
        <g transform="rotate(-150 25 -100)">
          <rect x="20" y="-104" width="11" height="40" rx="5.5" fill={shirt} />
          <circle cx="25.5" cy="-62" r="7" fill={skin} />
          <rect x="22" y="-56" width="5" height="9" rx="2.5" fill={skin} />
        </g>
      )}
      {pose === "give" && (
        <g transform="rotate(-60 25 -100)">
          <rect x="20" y="-104" width="11" height="48" rx="5.5" fill={shirt} />
          <circle cx="25.5" cy="-54" r="6" fill={skin} />
        </g>
      )}
      {pose === "carry" && (
        <g>
          <rect x="-28" y="-100" width="56" height="12" rx="6" fill={shirt} />
          <rect x="-30" y="-150" width="60" height="44" rx="3" fill="#b45309" />
          <rect x="-30" y="-150" width="60" height="44" rx="3" fill="none" stroke="#78350f" strokeWidth="2" />
          <line x1="-30" y1="-128" x2="30" y2="-128" stroke="#78350f" strokeWidth="2" />
        </g>
      )}

      {/* Long hair falls behind the head */}
      {hairStyle === "long" && <path d="M-22 -132 q0 -26 22 -26 q22 0 22 26 v32 q-5 5 -10 0 v-26 h-24 v26 q-5 5 -10 0z" fill={hair} />}

      {/* Neck and head */}
      <rect x="-6" y="-116" width="12" height="10" fill={skin} />
      <circle cx="0" cy="-130" r="18" fill={skin} />

      {/* Hair (front part always stays above the eyes) */}
      {hairStyle === "short" && <path d="M-18 -134 q2 -20 18 -20 q16 0 18 20 q-8 -10 -18 -9 q-10 -1 -18 9z" fill={hair} />}
      {hairStyle === "long" && <path d="M-19 -136 q1 -20 19 -20 q18 0 19 20 q-9 -9 -19 -8 q-10 -1 -19 8z" fill={hair} />}
      {hairStyle === "cap" && (
        <g>
          <path d="M-18 -134 q0 -20 18 -20 q18 0 18 20z" fill="#dc2626" />
          <rect x="4" y="-138" width="24" height="5" rx="2.5" fill="#b91c1c" />
        </g>
      )}
      {hairStyle === "hood" && <path d="M-24 -126 q-2 -32 24 -32 q26 0 24 32 q-4 -18 -24 -18 q-20 0 -24 18z" fill={hair} />}

      {/* Face */}
      <circle cx="-6" cy="-132" r="2.2" fill={palette.ink} />
      <circle cx="6" cy="-132" r="2.2" fill={palette.ink} />
      {mood === "worried" && (
        <>
          <path d="M-10 -139 l7 2" stroke={palette.ink} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M10 -139 l-7 2" stroke={palette.ink} strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {mood === "sly" && <path d="M-11 -137 l8 2 M11 -137 l-8 2" stroke={palette.ink} strokeWidth="1.8" strokeLinecap="round" />}
      {mouth}
    </g>
  )
}

/** Office backdrop: wall, floor and a window */
function OfficeBackdrop() {
  return (
    <g>
      <rect width="800" height="450" fill={palette.wall} />
      <rect y="330" width="800" height="120" fill={palette.floor} />
      <rect y="326" width="800" height="6" fill={palette.wallShade} />
      <rect x="40" y="50" width="150" height="110" rx="6" fill="#bfdbfe" stroke="#94a3b8" strokeWidth="4" />
      <line x1="115" y1="50" x2="115" y2="160" stroke="#94a3b8" strokeWidth="3" />
      <line x1="40" y1="105" x2="190" y2="105" stroke="#94a3b8" strokeWidth="3" />
    </g>
  )
}

function Desk({ x, y, width = 260 }: { x: number; y: number; width?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height="14" rx="3" fill={palette.deskTop} />
      <rect x={x + 10} y={y + 14} width="12" height={330 + 80 - y - 14} fill={palette.desk} />
      <rect x={x + width - 22} y={y + 14} width="12" height={330 + 80 - y - 14} fill={palette.desk} />
    </g>
  )
}

function Monitor({ x, y, alert = false }: { x: number; y: number; alert?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width="110" height="72" rx="6" fill="#0f172a" />
      <rect x={x + 6} y={y + 6} width="98" height="60" rx="3" fill={alert ? "#7f1d1d" : "#1e3a8a"} className="transition-colors duration-500" />
      <rect x={x + 46} y={y + 72} width="18" height="14" fill="#334155" />
      <rect x={x + 30} y={y + 84} width="50" height="6" rx="3" fill="#334155" />
    </g>
  )
}

/** HTML overlay positioned over the 16:9 stage */
function Overlay({ on, className, children }: { on: boolean; className: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute transition-all duration-700 ease-out",
        on ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        className
      )}
    >
      {children}
    </div>
  )
}

function Bubble({ children, tone = "neutral", tail = "left" }: { children: ReactNode; tone?: "neutral" | "danger" | "good"; tail?: "left" | "right" }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border-2 px-[1.6cqw] py-[1cqw] font-medium leading-snug shadow-md",
        tone === "neutral" && "border-slate-300 bg-white text-slate-900",
        tone === "danger" && "border-red-400 bg-red-50 text-red-900",
        tone === "good" && "border-green-400 bg-green-50 text-green-900"
      )}
    >
      {children}
      <span
        className={cn(
          "absolute -bottom-[7px] h-3 w-3 rotate-45 border-b-2 border-r-2",
          tail === "left" ? "left-5" : "right-5",
          tone === "neutral" && "border-slate-300 bg-white",
          tone === "danger" && "border-red-400 bg-red-50",
          tone === "good" && "border-green-400 bg-green-50"
        )}
      />
    </div>
  )
}

function Chip({ children, tone }: { children: ReactNode; tone: "danger" | "good" | "info" | "warning" }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-[0.8cqw] rounded-full px-[1.6cqw] py-[0.7cqw] font-semibold shadow-md",
        tone === "danger" && "bg-red-600 text-white",
        tone === "good" && "bg-green-600 text-white",
        tone === "info" && "bg-indigo-600 text-white",
        tone === "warning" && "bg-amber-500 text-amber-950"
      )}
    >
      {children}
    </div>
  )
}

const iconSize = "h-[2.2cqw] w-[2.2cqw] min-h-3 min-w-3"

/** 16:9 stage with an SVG scene and HTML overlays; text scales with the stage width */
function Stage({ svg, children }: { svg: ReactNode; children?: ReactNode }) {
  return (
    <div className="@container relative mx-auto aspect-video h-full max-h-full max-w-full overflow-hidden rounded-xl text-[clamp(9px,1.9cqw,16px)] shadow-inner">
      <svg viewBox="0 0 800 450" className="absolute inset-0 h-full w-full" aria-hidden>
        {svg}
      </svg>
      {children}
    </div>
  )
}

// ============================================================================
// SCENES
// ============================================================================

interface SceneProps {
  /** Index of the narration sentence currently playing */
  beat: number
  /** Narration is currently playing (animates Byte's mouth) */
  talking: boolean
}

function IntroScene({ beat, talking }: SceneProps) {
  // Arranged either side of the manipulated worker (who stands at about 72-81% across)
  const tags = [
    { label: "Trust", className: "left-[55%] top-[50%]" },
    { label: "Helpfulness", className: "left-[50%] top-[68%]" },
    { label: "Authority", className: "left-[83%] top-[50%]" },
    { label: "Fear", className: "left-[85%] top-[68%]" },
  ]
  return (
    <Stage
      svg={
        <g>
          <rect width="800" height="450" fill="#eef2ff" />
          <circle cx="160" cy="240" r="150" fill="#e0e7ff" />
          {/* Attacker controlling a puppet worker */}
          <g className={fade(beat >= 2)}>
            {/* Up in the corner, holding the control bar, clear of the title */}
            <Person x={725} y={116} scale={0.6} {...people.attacker} mood="sly" />
            <rect x="650" y="118" width="140" height="9" rx="4.5" fill="#475569" />
            <line x1="665" y1="127" x2="588" y2="282" stroke="#64748b" strokeWidth="2" strokeDasharray="4 4" />
            <line x1="775" y1="127" x2="645" y2="282" stroke="#64748b" strokeWidth="2" strokeDasharray="4 4" />
            <Person x={615} y={415} scale={0.95} {...people.sophie} mood="worried" />
          </g>
        </g>
      }
    >
      <div className="absolute bottom-[6%] left-[6%] h-[70%]">
        <TrainingBot talking={talking} waving={beat === 0} mood={beat >= 4 ? "happy" : "neutral"} className="h-full" />
      </div>
      <Overlay on={beat >= 0} className="left-[27%] top-[16%] w-[26%]">
        <Bubble>Hi, I&apos;m Byte, your security buddy!</Bubble>
      </Overlay>
      <Overlay on={beat >= 1} className="left-[50%] top-[4%]">
        <span className="text-[clamp(14px,3.6cqw,30px)] font-extrabold tracking-tight text-indigo-900">Social Engineering</span>
      </Overlay>
      {tags.map((tag, i) => (
        <Overlay key={tag.label} on={beat >= 3} className={cn(tag.className, ["delay-0", "delay-200", "delay-500", "delay-700"][i])}>
          <Chip tone="warning">{tag.label}</Chip>
        </Overlay>
      ))}
    </Stage>
  )
}

function PhoneCallScene({ beat }: SceneProps) {
  const ringing = beat === 1
  const callerLabel =
    beat >= 5
      ? { tone: "danger" as const, icon: PhoneOff, text: "Call ended" }
      : beat >= 3
        ? { tone: "danger" as const, icon: VenetianMask, text: "Not really IT" }
        : { tone: "info" as const, icon: PhoneCall, text: "\"Dave from IT\"" }
  return (
    <Stage
      svg={
        <g>
          <OfficeBackdrop />
          {/* Sophie standing at her desk */}
          <Desk x={205} y={305} width={230} />
          <Monitor x={300} y={219} />
          <Person x={150} y={418} scale={1.15} {...people.sophie} pose={beat >= 1 ? "phone" : "stand"} mood={beat >= 2 && beat < 5 ? "worried" : beat >= 5 ? "happy" : "neutral"} />
          {/* Desk phone */}
          <g transform="translate(225 287)">
            <g>
              {ringing && (
                <animateTransform attributeName="transform" type="rotate" values="0 28 10; -6 28 10; 6 28 10; 0 28 10" dur="0.35s" repeatCount="indefinite" />
              )}
              <rect x="0" y="0" width="56" height="20" rx="6" fill="#111827" />
              <rect x="6" y="-10" width="44" height="12" rx="6" fill="#1f2937" />
            </g>
            {ringing && (
              <g stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round">
                <path d="M62 -6 q8 8 0 16"><animate attributeName="opacity" values="1;0;1" dur="0.8s" repeatCount="indefinite" /></path>
                <path d="M70 -12 q14 14 0 28"><animate attributeName="opacity" values="0;1;0" dur="0.8s" repeatCount="indefinite" /></path>
              </g>
            )}
          </g>
          {/* Caller panel */}
          <g className={fade(beat >= 1)}>
            <rect x="480" y="30" width="295" height="300" rx="18" fill="#0f172a" />
            <Person x={628} y={322} scale={0.85} {...people.attacker} pose="phone" mood={beat >= 3 ? "sly" : "happy"} />
            <rect x="480" y="30" width="295" height="300" rx="18" fill="#0f172a" opacity={beat >= 5 ? 0.7 : 0} className="transition-opacity duration-700" />
          </g>
        </g>
      }
    >
      <Overlay on={beat === 0} className="left-[10%] top-[30%]">
        <Chip tone="info">Meet Sophie</Chip>
      </Overlay>
      {/* The caller's lines replace each other inside his panel */}
      <Overlay on={beat >= 1 && beat <= 4} className="left-[62%] top-[9%] w-[34%]">
        {beat <= 1 ? (
          <Bubble>Hi, it&apos;s Dave from IT. Your account is about to lock.</Bubble>
        ) : (
          <Bubble tone={beat >= 3 ? "danger" : "neutral"}>I just need your username and password to fix it.</Bubble>
        )}
      </Overlay>
      <Overlay on={beat >= 1} className="left-[62%] top-[77%]">
        <Chip tone={callerLabel.tone}>
          <callerLabel.icon className={iconSize} />
          {callerLabel.text}
        </Chip>
      </Overlay>
      <Overlay on={beat === 3} className="left-[30%] top-[12%]">
        <Chip tone="danger"><AlertTriangle className={iconSize} />Classic trick!</Chip>
      </Overlay>
      <Overlay on={beat === 4} className="bottom-[4%] left-[4%] right-[4%]">
        <div className="flex items-center justify-center gap-[1cqw] rounded-xl bg-red-600 px-[2cqw] py-[1.2cqw] text-center font-bold text-white shadow-lg">
          <Lock className={iconSize} />
          Real IT staff will never ask for your password
        </div>
      </Overlay>
      <Overlay on={beat >= 5} className="left-[3%] top-[10%] w-[40%]">
        <Bubble tone="good">No thanks. I&apos;ll call the helpdesk myself, on the official number.</Bubble>
      </Overlay>
    </Stage>
  )
}

function LeversScene({ beat, talking }: SceneProps) {
  const levers = [
    { icon: VenetianMask, title: "Pretexting", detail: "A made-up story: new starter, auditor, supplier" },
    { icon: Crown, title: "Authority", detail: "\"I'm the CEO. Do it now.\"" },
    { icon: AlarmClock, title: "Urgency & fear", detail: "\"Act now or there'll be trouble!\"" },
    { icon: HandHelping, title: "Helpfulness", detail: "\"Could you do me a quick favour?\"" },
  ]
  const positions = ["left-[30%] top-[8%]", "left-[64%] top-[8%]", "left-[30%] top-[52%]", "left-[64%] top-[52%]"]
  return (
    <Stage
      svg={
        <g>
          <rect width="800" height="450" fill="#f1f5f9" />
          {/* Attacker standing behind a control panel with four levers */}
          <Person x={115} y={330} scale={0.8} {...people.attacker} mood="sly" />
          <rect x="30" y="250" width="170" height="150" rx="14" fill="#334155" />
          {[0, 1, 2, 3].map((i) => {
            const pulled = beat >= i + 1
            return (
              <g key={i} transform={`translate(${55 + i * 38} 330)`}>
                <rect x="-4" y="-6" width="8" height="40" rx="4" fill="#1e293b" />
                {/* Pivots on the bottom of the handle */}
                <g className={cn("origin-bottom transition-[rotate] duration-500 [transform-box:fill-box]", pulled ? "rotate-[40deg]" : "-rotate-[40deg]")}>
                  <rect x="-3" y="-52" width="6" height="52" rx="3" fill="#94a3b8" />
                  <circle cx="0" cy="-54" r="9" fill={pulled ? "#ef4444" : "#64748b"} className="transition-colors duration-500" />
                </g>
              </g>
            )
          })}
        </g>
      }
    >
      <div className="absolute left-[3%] top-[5%] h-[30%]">
        <TrainingBot talking={talking} className="h-full" />
      </div>
      <Overlay on={beat === 0} className="left-[34%] top-[38%]">
        <span className="text-[clamp(14px,3.4cqw,28px)] font-extrabold text-slate-800">4 levers attackers pull</span>
      </Overlay>
      {levers.map((lever, i) => (
        <Overlay key={lever.title} on={beat >= i + 1} className={cn(positions[i], "w-[32%]")}>
          <div className={cn("rounded-xl border-2 bg-white p-[1.4cqw] shadow-md", beat === i + 1 ? "border-red-400" : "border-slate-200")}>
            <div className="mb-[0.5cqw] flex items-center gap-[1cqw] font-bold text-slate-900">
              <lever.icon className={cn(iconSize, "text-red-600")} />
              {lever.title}
            </div>
            <p className="leading-snug text-slate-600">{lever.detail}</p>
          </div>
        </Overlay>
      ))}
    </Stage>
  )
}

function TailgatingScene({ beat }: SceneProps) {
  const doorOpen = beat >= 1 && beat <= 3
  return (
    <Stage
      svg={
        <g>
          <rect width="800" height="450" fill="#e2e8f0" />
          <rect y="340" width="800" height="110" fill="#94a3b8" />
          {/* Secure sliding door: the panel slides out of the doorway when the badge is accepted */}
          <defs>
            <clipPath id="tailgating-doorway">
              <rect x="280" y="100" width="130" height="240" />
            </clipPath>
          </defs>
          <rect x="270" y="90" width="150" height="250" fill="#475569" />
          <rect x="280" y="100" width="130" height="240" fill="#0f172a" />
          <g clipPath="url(#tailgating-doorway)">
            <g className={cn("transition-[translate] duration-700 ease-in-out", doorOpen ? "-translate-x-[118px]" : "translate-x-0")}>
              <rect x="280" y="100" width="130" height="240" fill="#64748b" />
              <circle cx="395" cy="225" r="6" fill="#cbd5e1" />
            </g>
          </g>
          <rect x="285" y="60" width="120" height="24" rx="4" fill="#1e293b" />
          <text x="345" y="77" textAnchor="middle" fontSize="13" fontWeight="700" fill="#f8fafc">STAFF ONLY</text>
          {/* Badge reader */}
          <rect x="440" y="190" width="28" height="44" rx="5" fill="#1e293b" />
          <circle cx="454" cy="204" r="6" fill={beat >= 1 && beat <= 3 ? "#22c55e" : "#ef4444"} className="transition-colors duration-300" />
          {/* Reception sign */}
          <g className={fade(beat >= 4)}>
            <rect x="590" y="70" width="170" height="44" rx="8" fill="#16a34a" />
            <text x="660" y="99" textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff">Reception →</text>
          </g>
          {/* Sophie */}
          <g className={cn("transition-[translate] duration-1000 ease-in-out", beat >= 1 && beat <= 3 ? "-translate-x-[125px]" : "translate-x-0")}>
            <Person x={470} y={400} {...people.sophie} pose={beat === 0 ? "give" : beat >= 4 ? "point" : "stand"} mood={beat >= 4 ? "happy" : "neutral"} />
          </g>
          {/* Stranger with boxes */}
          <g className={cn(fade(beat >= 2, false), "transition-[translate,opacity] duration-1000", beat >= 4 ? "translate-x-[40px]" : beat >= 2 ? "translate-x-0" : "translate-x-[200px]")}>
            <Person x={470} y={400} {...people.stranger} pose="carry" mood={beat >= 4 ? "worried" : "happy"} />
            {beat === 3 && <rect x="420" y="220" width="100" height="190" rx="14" fill="none" stroke="#dc2626" strokeWidth="4" strokeDasharray="10 6" />}
          </g>
        </g>
      }
    >
      <Overlay on={beat >= 1 && beat < 4} className="left-[60%] top-[30%]">
        <Chip tone="good"><Check className={iconSize} />Badge accepted</Chip>
      </Overlay>
      <Overlay on={beat === 2} className="left-[66%] top-[46%]">
        <Chip tone="warning">No badge!</Chip>
      </Overlay>
      <Overlay on={beat === 3} className="left-[30%] top-[4%]">
        <span className="rounded-lg bg-red-600 px-[2cqw] py-[0.8cqw] text-[clamp(14px,3.6cqw,30px)] font-black tracking-wide text-white shadow-lg">TAILGATING</span>
      </Overlay>
      <Overlay on={beat >= 4} className="left-[34%] top-[16%] w-[34%]">
        <Bubble tone="good">Sorry, I can&apos;t let you in. Reception will sign you in, just over there!</Bubble>
      </Overlay>
    </Stage>
  )
}

function UsbDropScene({ beat }: SceneProps) {
  return (
    <Stage
      svg={
        <g>
          <rect width="800" height="450" fill="#cbd5e1" />
          <rect y="200" width="800" height="250" fill="#475569" />
          {[80, 260, 440, 620].map((x) => (
            <rect key={x} x={x} y="230" width="8" height="200" fill="#f8fafc" opacity="0.8" />
          ))}
          {/* Car */}
          <g transform="translate(110 210)">
            <rect x="0" y="40" width="190" height="60" rx="18" fill="#2563eb" />
            <path d="M35 40 q20 -38 60 -38 h20 q40 0 60 38z" fill="#3b82f6" />
            <path d="M58 38 q14 -26 42 -26 h8 v26z M116 12 h6 q28 0 42 26 h-48z" fill="#bfdbfe" />
            <circle cx="45" cy="100" r="20" fill="#0f172a" />
            <circle cx="150" cy="100" r="20" fill="#0f172a" />
          </g>
          {/* USB stick on the ground */}
          <g className={cn("transition-[translate,opacity] duration-1000", beat >= 4 ? "opacity-0" : "opacity-100", beat >= 1 && beat < 4 ? "translate-x-[90px] -translate-y-[150px]" : "")}>
            <circle cx="470" cy="380" r="26" fill="#fde047" opacity="0.35">
              <animate attributeName="r" values="20;34;20" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <rect x="452" y="372" width="34" height="16" rx="3" fill="#ef4444" />
            <rect x="486" y="375" width="12" height="10" fill="#cbd5e1" />
          </g>
          {/* Laptop */}
          <g className={fade(beat >= 1 && beat < 4)}>
            <rect x="500" y="150" width="160" height="100" rx="8" fill="#0f172a" />
            <rect x="508" y="158" width="144" height="84" rx="4" fill={beat >= 3 ? "#7f1d1d" : "#1e3a8a"} className="transition-colors duration-500" />
            <rect x="480" y="250" width="200" height="12" rx="4" fill="#334155" />
          </g>
          {/* IT desk */}
          <g className={fade(beat >= 4)}>
            <Person x={620} y={420} {...people.itDesk} pose="give" mood="happy" flip />
            <Person x={420} y={420} {...people.sophie} pose="give" mood="happy" />
            <rect x="500" y="300" width="34" height="16" rx="3" fill="#ef4444" />
          </g>
        </g>
      }
    >
      <Overlay on={beat === 0} className="left-[50%] top-[64%]">
        <Chip tone="warning">&quot;Salaries 2025&quot;</Chip>
      </Overlay>
      <Overlay on={beat === 1} className="left-[46%] top-[6%] w-[30%]">
        <Bubble>Whose is this? Let&apos;s plug it in and see...</Bubble>
      </Overlay>
      <Overlay on={beat === 2} className="left-[57%] top-[20%]">
        <div className="flex h-[16cqw] w-[16cqw] items-center justify-center rounded-full border-[1.2cqw] border-red-600 bg-red-600/10">
          <X className="h-[11cqw] w-[11cqw] text-red-600" strokeWidth={3} />
        </div>
      </Overlay>
      <Overlay on={beat === 2} className="left-[24%] top-[8%]">
        <span className="text-[clamp(16px,5cqw,44px)] font-black text-red-600">Don&apos;t!</span>
      </Overlay>
      {[
        "left-[66%] top-[22%]",
        "left-[74%] top-[30%]",
        "left-[69%] top-[40%]",
        "left-[78%] top-[18%]",
      ].map((position, i) => (
        <Overlay key={position} on={beat === 3} className={cn(position, ["delay-0", "delay-150", "delay-300", "delay-500"][i])}>
          <Bug className="h-[4cqw] w-[4cqw] text-red-500 drop-shadow" />
        </Overlay>
      ))}
      <Overlay on={beat === 3} className="left-[4%] top-[8%] w-[36%]">
        <Chip tone="danger"><ShieldAlert className={iconSize} />Malware installs on connect</Chip>
      </Overlay>
      <Overlay on={beat >= 4} className="left-[34%] top-[8%]">
        <Chip tone="good"><CheckCircle2 className={iconSize} />Handed to IT, never plugged in</Chip>
      </Overlay>
    </Stage>
  )
}

function BankChangeScene({ beat }: SceneProps) {
  return (
    <Stage svg={<rect width="800" height="450" fill="#f1f5f9" />}>
      {/* Email window */}
      <Overlay on className="left-[3%] top-[6%] w-[57%]">
        <div className="relative overflow-hidden rounded-xl border bg-white text-slate-900 shadow-lg">
          <div className="border-b bg-slate-50 px-[1.6cqw] py-[1cqw]">
            <p><span className="text-slate-500">From:</span> <b>Northwind Supplies</b></p>
            <p className={cn("w-fit rounded px-0.5 text-[0.85em]", beat >= 2 ? "bg-red-100 text-red-700" : "text-slate-500")}>
              accounts@northwind-supplies-billing.com
            </p>
            <p><span className="text-slate-500">Subject:</span> <b>Updated bank details</b></p>
          </div>
          <div className="space-y-[0.8cqw] px-[1.6cqw] py-[1.2cqw]">
            <p>Hello,</p>
            <p className={cn("transition-opacity duration-700", beat >= 1 ? "opacity-100" : "opacity-0")}>
              Our bank details have changed. Please pay the next invoice to:
            </p>
            <p className={cn("rounded-md px-[1cqw] py-[0.6cqw] font-semibold tabular-nums transition-all duration-700", beat >= 1 ? "opacity-100" : "opacity-0", beat >= 2 ? "bg-red-100 text-red-800 ring-2 ring-red-400" : "bg-slate-100")}>
              Sort code 20-45-77 · Account 41983377
            </p>
            <div className="flex gap-[1cqw] pt-[0.4cqw]">
              <span className={cn("relative rounded-md border px-[1.4cqw] py-[0.4cqw]", beat >= 2 && "border-red-400 text-red-700")}>
                Reply
                {beat >= 2 && <span className="absolute inset-x-1 top-1/2 h-0.5 -rotate-12 bg-red-600" />}
              </span>
              <span className={cn("relative rounded-md border px-[1.4cqw] py-[0.4cqw]", beat >= 2 && "border-red-400 text-red-700")}>
                Update details
                {beat >= 2 && <span className="absolute inset-x-1 top-1/2 h-0.5 -rotate-12 bg-red-600" />}
              </span>
            </div>
          </div>
          {beat >= 4 && (
            <div className="absolute right-[6%] top-[38%] -rotate-12 rounded-lg border-4 border-red-600 px-[1.6cqw] py-[0.4cqw] text-[clamp(14px,4cqw,34px)] font-black text-red-600 animate-in zoom-in-150 fade-in duration-500">
              FRAUD
            </div>
          )}
        </div>
      </Overlay>
      <Overlay on={beat === 2} className="left-[6%] bottom-[8%]">
        <Chip tone="danger"><AlertTriangle className={iconSize} />Never change payment details from an email</Chip>
      </Overlay>
      {/* Verification call */}
      <Overlay on={beat >= 3} className="right-[4%] top-[10%] w-[36%]">
        <div className="space-y-[1cqw] rounded-xl border bg-white p-[1.6cqw] text-slate-900 shadow-lg">
          <p className="flex items-center gap-[1cqw] font-semibold"><BookUser className={iconSize} />Your supplier records</p>
          <p className="rounded-md bg-slate-100 px-[1cqw] py-[0.6cqw]">Northwind Supplies<br /><span className="font-semibold tabular-nums">020 7946 0321</span></p>
          <Chip tone="info"><PhoneCall className={iconSize} />Calling the known number...</Chip>
        </div>
      </Overlay>
      <Overlay on={beat >= 4} className="right-[5%] top-[62%] w-[34%]">
        <Bubble tone="good" tail="right">We never changed our bank details! Thanks for checking.</Bubble>
      </Overlay>
    </Stage>
  )
}

function OvershareScene({ beat }: SceneProps) {
  const safe = beat >= 4
  return (
    <Stage
      svg={
        <g>
          <rect width="800" height="450" fill="#f5f3ff" />
          <rect y="360" width="800" height="90" fill="#e4e0f5" />
          {/* Attacker at a laptop, browsing Sophie's profile */}
          <Person x={95} y={420} {...people.attacker} mood="sly" />
          <rect x="40" y="318" width="190" height="12" rx="3" fill={palette.deskTop} />
          <rect x="52" y="330" width="10" height="90" fill={palette.desk} />
          <rect x="208" y="330" width="10" height="90" fill={palette.desk} />
          <g transform="translate(120 250)">
            <rect x="0" y="0" width="100" height="66" rx="5" fill="#0f172a" />
            <rect x="5" y="5" width="90" height="56" rx="3" fill="#ede9fe" />
            <circle cx="22" cy="22" r="9" fill="#0ea5e9" />
            <rect x="36" y="16" width="48" height="5" rx="2.5" fill="#a78bfa" />
            <rect x="36" y="25" width="34" height="5" rx="2.5" fill="#c4b5fd" />
            <rect x="12" y="38" width="76" height="17" rx="2" fill="#bae6fd" />
            <rect x="-10" y="66" width="120" height="6" rx="3" fill="#334155" />
          </g>
          {/* Magnifying glass */}
          <g transform="translate(205 225)" className={fade(beat === 0 || beat === 3)}>
            <circle cx="0" cy="0" r="20" fill="#ffffff" fillOpacity="0.5" stroke="#334155" strokeWidth="6" />
            <line x1="14" y1="14" x2="34" y2="34" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
          </g>
        </g>
      }
    >
      <Overlay on={beat === 0 || beat === 3} className="left-[2%] top-[14%]">
        <Chip tone="danger"><Search className={iconSize} />Researching...</Chip>
      </Overlay>
      {/* Social post */}
      <Overlay on={beat >= 1} className="left-[32%] top-[4%] w-[38%]">
        <div className="overflow-hidden rounded-xl border bg-white text-slate-900 shadow-lg">
          <div className="flex items-center gap-[1cqw] px-[1.4cqw] py-[1cqw]">
            <span className="h-[3.4cqw] w-[3.4cqw] rounded-full bg-sky-500" />
            <span className="font-semibold">Sophie S.</span>
            <span className="text-slate-500">· just now</span>
          </div>
          {/* Photo: Sophie with badge, screen behind */}
          <div className="relative h-[17cqw] bg-gradient-to-b from-sky-100 to-sky-200">
            <div className={cn("absolute left-[8%] top-[14%] h-[60%] w-[38%] rounded bg-blue-900 transition-[filter] duration-700", safe && "blur-[6px]", beat === 3 && "ring-4 ring-red-500")}>
              <div className="m-[6%] space-y-1">
                <div className="h-1.5 w-3/4 rounded bg-blue-300/70" />
                <div className="h-1.5 w-1/2 rounded bg-blue-300/70" />
                <div className="h-1.5 w-2/3 rounded bg-blue-300/70" />
              </div>
            </div>
            <div className="absolute bottom-0 left-[56%] h-[78%] w-[30%] rounded-t-full bg-sky-500" />
            <div className="absolute left-[64%] top-[6%] h-[34%] w-[14%] rounded-full bg-[#c68863]" />
            <div className={cn("absolute bottom-[14%] left-[66%] rounded-sm bg-white px-1 text-[0.8em] font-bold text-slate-800 shadow transition-[filter] duration-700", safe && "blur-[4px]", beat === 3 && "ring-4 ring-red-500")}>
              ACME · STAFF
            </div>
          </div>
          <div className="space-y-[0.5cqw] px-[1.4cqw] py-[1cqw]">
            <p>First day at Acme! Love my new desk.</p>
            <p className={cn("transition-all duration-700", beat >= 2 ? "opacity-100" : "opacity-0", beat === 3 && "rounded bg-red-100 text-red-800", safe && "text-slate-400 line-through")}>
              Off to SecureCon in Berlin all next week!
            </p>
          </div>
        </div>
      </Overlay>
      {/* What the attacker learns */}
      <Overlay on={beat === 3} className="right-[3%] top-[10%] w-[26%]">
        <div className="space-y-[0.6cqw] rounded-xl border-2 border-red-300 bg-red-50 p-[1.4cqw] text-red-900 shadow-md">
          <p className="font-bold">Attacker&apos;s notes</p>
          <p>✓ Badge design</p>
          <p>✓ Systems on screen</p>
          <p>✓ Away next week</p>
        </div>
      </Overlay>
      <Overlay on={safe} className="right-[3%] top-[12%] w-[26%]">
        <div className="space-y-[0.6cqw] rounded-xl border-2 border-green-300 bg-green-50 p-[1.4cqw] text-green-900 shadow-md">
          <p className="font-bold">Keep it safe</p>
          <p>✓ Job title and news: fine</p>
          <p>✗ Badges and screens</p>
          <p>✗ Travel plans</p>
        </div>
      </Overlay>
    </Stage>
  )
}

function VerifyScene({ beat, talking }: SceneProps) {
  return (
    <Stage
      svg={
        <g>
          <rect width="800" height="450" fill="#ecfdf5" />
          <g className={fade(beat >= 2)}>
            <Person x={660} y={430} {...people.colleague} pose="thumbs" mood="happy" />
          </g>
          {/* Torn attacker script */}
          <g className={fade(beat >= 3)}>
            <Person x={470} y={430} scale={0.85} {...people.attacker} mood="worried" />
            <g className={cn("origin-bottom-right transition-[rotate,translate] delay-500 duration-700 [transform-box:fill-box]", beat >= 3 && "-translate-x-[8px] -rotate-[18deg]")}>
              <rect x="388" y="230" width="38" height="56" rx="3" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
            </g>
            <g className={cn("origin-bottom-left transition-[rotate,translate] delay-500 duration-700 [transform-box:fill-box]", beat >= 3 && "translate-x-[8px] rotate-[18deg]")}>
              <rect x="430" y="230" width="38" height="56" rx="3" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
            </g>
            <text x="428" y="222" textAnchor="middle" fontSize="14" fontWeight="700" fill="#475569">SCRIPT</text>
          </g>
        </g>
      }
    >
      <div className="absolute bottom-[5%] left-[4%] h-[62%]">
        <TrainingBot talking={talking} mood={beat >= 4 ? "happy" : "neutral"} waving={beat >= 4} className="h-full" />
      </div>
      <Overlay on={beat >= 0} className="left-[5%] top-[6%]">
        <Chip tone="warning"><Star className={iconSize} />The golden rule</Chip>
      </Overlay>
      <Overlay on={beat === 1} className="left-[32%] top-[10%] w-[62%]">
        <div className="space-y-[1cqw] rounded-xl border bg-white p-[1.6cqw] text-slate-900 shadow-lg">
          <p className="rounded-md bg-amber-50 px-[1cqw] py-[0.6cqw] font-medium">&quot;Urgent: pay this invoice today, don&apos;t tell anyone.&quot;</p>
          <div className="grid grid-cols-2 gap-[1cqw]">
            <div className="flex items-center gap-[0.8cqw] rounded-md bg-red-50 px-[1cqw] py-[0.8cqw] text-red-800">
              <X className={iconSize} />Reply to the message
            </div>
            <div className="flex items-center gap-[0.8cqw] rounded-md bg-green-50 px-[1cqw] py-[0.8cqw] text-green-800">
              <Check className={iconSize} />Call a known number or ask in person
            </div>
          </div>
        </div>
      </Overlay>
      <Overlay on={beat >= 2} className="right-[3%] top-[22%] w-[26%]">
        <Bubble tone="good" tail="right">Thanks for checking with me!</Bubble>
      </Overlay>
      <Overlay on={beat >= 3} className="left-[46%] top-[30%]">
        <Chip tone="danger">Script falls apart</Chip>
      </Overlay>
      <Overlay on={beat >= 4} className="left-[34%] top-[6%]">
        <span className="text-[clamp(16px,4.4cqw,38px)] font-extrabold text-emerald-700">Quiz time!</span>
      </Overlay>
    </Stage>
  )
}

const scenes: Record<LessonIllustration, (props: SceneProps) => ReactNode> = {
  "se-intro": IntroScene,
  "se-phone-call": PhoneCallScene,
  "se-levers": LeversScene,
  "se-tailgating": TailgatingScene,
  "se-usb-drop": UsbDropScene,
  "se-bank-change": BankChangeScene,
  "se-overshare": OvershareScene,
  "se-verify": VerifyScene,
}

/** Illustrations that already include Byte, so the player hides its corner presenter */
export const illustrationsWithBot: ReadonlySet<LessonIllustration> = new Set(["se-intro", "se-levers", "se-verify"])

export function LessonIllustrationView({ scene, beat, talking }: { scene: LessonIllustration } & SceneProps) {
  const Scene = scenes[scene]
  return <Scene beat={beat} talking={talking} />
}
