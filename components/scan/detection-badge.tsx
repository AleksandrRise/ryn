import { SearchCodeIcon, SparklesIcon, Combine } from "lucide-react"
import type { DetectionMethod } from "@/lib/types/violation"

interface DetectionBadgeProps {
  method: DetectionMethod
  className?: string
}

export function DetectionBadge({ method, className = "" }: DetectionBadgeProps) {
  const styles = {
    regex: {
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
      icon: SearchCodeIcon,
      label: "Pattern",
    },
    llm: {
      bg: "bg-purple-500/10",
      text: "text-purple-600 dark:text-purple-400",
      icon: SparklesIcon,
      label: "AI",
    },
    hybrid: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: Combine,
      label: "Hybrid",
    },
  }

  const style = styles[method]
  const Icon = style.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${style.bg} ${style.text} text-xs font-medium ${className}`}
    >
      <Icon className="size-3" />
      {style.label}
    </span>
  )
}
