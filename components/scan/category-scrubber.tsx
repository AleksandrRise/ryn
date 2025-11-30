"use client"

import { cn } from "@/lib/utils"

// Category definitions with colors matching plan
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bgClass: string }> = {
  "CC6.1": { label: "Access", color: "#a855f7", bgClass: "bg-purple-500" },
  "CC6.7": { label: "Secrets", color: "#ef4444", bgClass: "bg-red-500" },
  "CC7.2": { label: "Logging", color: "#f97316", bgClass: "bg-orange-500" },
  "A1.2": { label: "Resilience", color: "#3b82f6", bgClass: "bg-blue-500" },
}

interface CategoryInfo {
  id: string
  count: number
}

interface CategoryScrubberProps {
  categories: CategoryInfo[]
  activeCategory: string | null
  onCategoryClick: (id: string) => void
}

export function CategoryScrubber({ categories, activeCategory, onCategoryClick }: CategoryScrubberProps) {
  // Only show categories that have violations
  const visibleCategories = categories.filter(c => c.count > 0)

  if (visibleCategories.length === 0) return null

  return (
    <div className="flex flex-col items-center gap-1 py-2 px-1.5">
      {visibleCategories.map((category) => {
        const config = CATEGORY_CONFIG[category.id]
        const isActive = activeCategory === category.id

        if (!config) return null

        return (
          <button
            key={category.id}
            onClick={() => onCategoryClick(category.id)}
            className={cn(
              "group relative flex flex-col items-center gap-0.5 py-1.5 px-1 rounded transition-all duration-150",
              isActive ? "bg-white/10" : "hover:bg-white/5"
            )}
            title={`${config.label} (${category.count})`}
          >
            {/* Colored dot indicator */}
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-150",
                config.bgClass,
                isActive ? "scale-125 shadow-lg" : "opacity-70 group-hover:opacity-100"
              )}
              style={{ boxShadow: isActive ? `0 0 8px ${config.color}` : undefined }}
            />

            {/* Category ID label */}
            <span
              className={cn(
                "text-[9px] font-mono tracking-tight transition-colors",
                isActive ? "text-white/90" : "text-white/40 group-hover:text-white/60"
              )}
            >
              {category.id.replace("CC", "")}
            </span>

            {/* Tooltip on hover showing full info */}
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/95 border border-white/10 rounded text-[10px] text-white/80 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
              <span className="font-medium">{config.label}</span>
              <span className="text-white/50 ml-1.5">({category.count})</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export { CATEGORY_CONFIG }
