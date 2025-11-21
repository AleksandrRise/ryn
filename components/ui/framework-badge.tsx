import React from "react"
import { motion } from "framer-motion"
import {
  SiExpress,
  SiNextdotjs,
  SiReact,
  SiVuedotjs,
  SiAngular,
  SiSvelte,
  SiDjango,
  SiFlask,
  SiRubyonrails,
  SiSpring,
} from "react-icons/si"
import type { IconType } from "react-icons"

const frameworkIcons: { match: (name: string) => boolean; Icon: IconType; label: string }[] = [
  { match: (name) => name.includes("express"), Icon: SiExpress, label: "Express" },
  { match: (name) => name.includes("next"), Icon: SiNextdotjs, label: "Next.js" },
  { match: (name) => name.includes("react"), Icon: SiReact, label: "React" },
  { match: (name) => name.includes("vue"), Icon: SiVuedotjs, label: "Vue" },
  { match: (name) => name.includes("angular"), Icon: SiAngular, label: "Angular" },
  { match: (name) => name.includes("svelte"), Icon: SiSvelte, label: "Svelte" },
  { match: (name) => name.includes("django"), Icon: SiDjango, label: "Django" },
  { match: (name) => name.includes("flask"), Icon: SiFlask, label: "Flask" },
  { match: (name) => name.includes("rails"), Icon: SiRubyonrails, label: "Rails" },
  { match: (name) => name.includes("spring"), Icon: SiSpring, label: "Spring" },
]

interface FrameworkBadgeProps {
  framework?: string | null
  className?: string
  showLabel?: boolean
}

export function FrameworkBadge({ framework, className = "", showLabel = true }: FrameworkBadgeProps) {
  if (!framework) return null

  const normalize = (fw: string) => {
    const lower = fw.toLowerCase().replace(/\s+/g, "")
    if (lower === "express.js" || lower === "expressjs") return "express"
    if (lower === "next.js" || lower === "nextjs") return "nextjs"
    if (lower === "react.js" || lower === "reactjs") return "react"
    if (lower === "rubyonrails") return "rails"
    if (lower === "springboot") return "spring"
    return lower
  }

  const key = normalize(framework)
  const entry = frameworkIcons.find((f) => f.match(key))

  return (
    <motion.div
      layout
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 ${className}`}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
    >
      {entry ? <entry.Icon size={16} className="shrink-0 text-white" /> : <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />}
      {showLabel && (
        <span className="text-[10px] font-medium capitalize text-white/80">{entry?.label || framework}</span>
      )}
    </motion.div>
  )
}
