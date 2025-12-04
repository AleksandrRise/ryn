# Halloween Theme Integration Examples

## Quick Start

### 1. Enable Halloween Mode in Settings
Navigate to Settings and toggle the Halloween Mode switch. The theme persists across sessions via localStorage.

### 2. View Haunted Violations
Go to the Scan page with an active project. Violations will now appear as floating ghost cards with spooky animations.

### 3. Banish Ghosts
Apply a fix to see the satisfying "poof" animation as the ghost is banished.

## Integration Patterns

### Pattern 1: Wrap Existing Violation List

Replace your standard violation rendering with the Halloween wrapper:

```tsx
// Before
<div className="violations-list">
  {violations.map(v => (
    <ViolationCard key={v.id} violation={v} />
  ))}
</div>

// After
import { HalloweenScanWrapper } from "@/components/scan/HalloweenScanWrapper"

<HalloweenScanWrapper
  violations={violations}
  onViolationClick={handleClick}
  isScanning={isScanning}
  scanProgress={progress}
>
  {/* Fallback for when Halloween mode is off */}
  <div className="violations-list">
    {violations.map(v => (
      <ViolationCard key={v.id} violation={v} />
    ))}
  </div>
</HalloweenScanWrapper>
```

### Pattern 2: Conditional Rendering

Use the theme hook to conditionally render Halloween components:

```tsx
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"
import { SpookyViolationCard } from "@/components/halloween/SpookyViolationCard"

function ViolationList({ violations }) {
  const { isEnabled } = useHalloweenTheme()
  
  return (
    <div className="space-y-3">
      {violations.map((violation, index) => (
        isEnabled ? (
          <SpookyViolationCard
            key={violation.id}
            violation={violation}
            index={index}
          />
        ) : (
          <StandardViolationCard
            key={violation.id}
            violation={violation}
          />
        )
      ))}
    </div>
  )
}
```

### Pattern 3: Banish Animation on Fix

Trigger the poof effect when applying fixes:

```tsx
import { usePoofEffect } from "@/lib/hooks/usePoofEffect"
import { BanishGhostAnimation } from "@/components/halloween/BanishGhostAnimation"

function FixButton({ violation, fixId }) {
  const { isPoofing, triggerPoof } = usePoofEffect()
  
  const handleApplyFix = async () => {
    try {
      await apply_fix(fixId)
      triggerPoof("Ghost banished! The spirit has been laid to rest.")
      // Refresh violations list
      await reload()
    } catch (error) {
      console.error("Failed to apply fix:", error)
    }
  }
  
  return (
    <>
      <button onClick={handleApplyFix}>
        Apply Fix
      </button>
      <BanishGhostAnimation
        isVisible={isPoofing}
        severity={violation.severity}
      />
    </>
  )
}
```

### Pattern 4: Haunting Meter During Scans

Show the spooky progress bar while scanning:

```tsx
import { HauntingMeter } from "@/components/halloween/HauntingMeter"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

function ScanProgress({ progress }) {
  const { isEnabled } = useHalloweenTheme()
  
  if (!isEnabled) {
    return <StandardProgressBar progress={progress} />
  }
  
  return <HauntingMeter progress={progress} />
}
```

### Pattern 5: Custom Ghost Animations

Use the ghost animation hook for custom components:

```tsx
import { motion } from "framer-motion"
import { useGhostAnimation } from "@/lib/hooks/useGhostAnimation"

function CustomGhostElement({ severity }) {
  const { animate, transition } = useGhostAnimation(severity)
  
  return (
    <motion.div
      animate={animate}
      transition={transition}
      className="ghost-element"
    >
      👻
    </motion.div>
  )
}
```

## Dashboard Integration

### Adding Halloween Stats to Dashboard

```tsx
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

function DashboardStats({ violations }) {
  const { isEnabled } = useHalloweenTheme()
  
  const criticalCount = violations.filter(v => v.severity === "critical").length
  
  return (
    <div className="stat-card">
      <div className="stat-icon">
        {isEnabled ? "💀" : "🔴"}
      </div>
      <div className="stat-value">{criticalCount}</div>
      <div className="stat-label">
        {isEnabled ? "Vengeful Spirits" : "Critical"}
      </div>
    </div>
  )
}
```

### Halloween-Themed Toasts

```tsx
import { toast } from "sonner"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

function showScanComplete(violations) {
  const { isEnabled } = useHalloweenTheme()
  
  if (isEnabled) {
    toast.success("The séance is complete", {
      description: `${violations.length} spirits detected in your code`,
      icon: "🔮"
    })
  } else {
    toast.success("Scan complete", {
      description: `${violations.length} violations found`
    })
  }
}
```

## Advanced Customization

### Creating Custom Severity Configs

```tsx
import { useGhostAnimation } from "@/lib/hooks/useGhostAnimation"

// Extend the hook for custom severity levels
function useCustomGhostAnimation(customSeverity: string) {
  const baseConfig = useGhostAnimation("medium")
  
  const customConfigs = {
    "ultra-critical": {
      duration: 1,
      yOffset: 15,
      rotation: 5,
      glowIntensity: 1.0
    }
  }
  
  return customConfigs[customSeverity] || baseConfig
}
```

### Adding Custom Easter Eggs

```tsx
import { useEffect } from "react"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

function MidnightChime() {
  const { isEnabled } = useHalloweenTheme()
  
  useEffect(() => {
    if (!isEnabled) return
    
    const checkMidnight = () => {
      const now = new Date()
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        // Trigger special midnight animation
        triggerMidnightAnimation()
      }
    }
    
    const interval = setInterval(checkMidnight, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [isEnabled])
  
  return null
}
```

### Konami Code Activation

```tsx
import { useEffect, useState } from "react"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

const KONAMI_CODE = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a"
]

function KonamiCodeListener() {
  const [keys, setKeys] = useState<string[]>([])
  const { enable } = useHalloweenTheme()
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => [...prev.slice(-9), e.key])
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])
  
  useEffect(() => {
    if (keys.join(",") === KONAMI_CODE.join(",")) {
      enable()
      toast.success("Super Spooky Mode Activated! 👻", {
        description: "The spirits are pleased..."
      })
      setKeys([])
    }
  }, [keys, enable])
  
  return null
}
```

## Testing Integration

### Unit Test Example

```tsx
import { render, screen } from "@testing-library/react"
import { HalloweenScanWrapper } from "@/components/scan/HalloweenScanWrapper"

describe("HalloweenScanWrapper", () => {
  it("renders haunted house when theme is enabled", () => {
    localStorage.setItem("ryn-halloween-mode", "true")
    
    render(
      <HalloweenScanWrapper violations={mockViolations}>
        <div>Standard List</div>
      </HalloweenScanWrapper>
    )
    
    expect(screen.getByText("Haunted Code Mansion")).toBeInTheDocument()
  })
  
  it("renders children when theme is disabled", () => {
    localStorage.setItem("ryn-halloween-mode", "false")
    
    render(
      <HalloweenScanWrapper violations={mockViolations}>
        <div>Standard List</div>
      </HalloweenScanWrapper>
    )
    
    expect(screen.getByText("Standard List")).toBeInTheDocument()
  })
})
```

### E2E Test Example

```typescript
// e2e-tests/halloween-theme.spec.ts
import { test, expect } from "@playwright/test"

test("Halloween theme toggle", async ({ page }) => {
  await page.goto("/settings")
  
  // Enable Halloween mode
  await page.click('[aria-label="Halloween Mode toggle"]')
  
  // Navigate to scan page
  await page.goto("/scan")
  
  // Verify ghost emojis are visible
  await expect(page.locator("text=👻")).toBeVisible()
  
  // Verify haunted house header
  await expect(page.locator("text=Haunted Code Mansion")).toBeVisible()
})
```

## Performance Tips

### 1. Lazy Load Components
```tsx
import dynamic from "next/dynamic"

const HauntedHouse = dynamic(
  () => import("@/components/halloween/HauntedHouse"),
  { ssr: false }
)
```

### 2. Memoize Expensive Calculations
```tsx
import { useMemo } from "react"

const groupedViolations = useMemo(() => {
  return violations.reduce((acc, v) => {
    // Group by severity
    return acc
  }, {})
}, [violations])
```

### 3. Throttle Animation Updates
```tsx
import { useReducedMotion } from "framer-motion"

function OptimizedGhost() {
  const shouldReduceMotion = useReducedMotion()
  
  if (shouldReduceMotion) {
    return <StaticGhost />
  }
  
  return <AnimatedGhost />
}
```

## Troubleshooting

### Theme Not Persisting
Check localStorage is accessible:
```tsx
if (typeof window !== "undefined") {
  localStorage.setItem("ryn-halloween-mode", "true")
}
```

### Animations Not Working
Ensure Framer Motion is installed:
```bash
pnpm add framer-motion
```

### Ghosts Not Appearing
Verify theme is enabled:
```tsx
const { isEnabled } = useHalloweenTheme()
console.log("Halloween mode:", isEnabled)
```

### Performance Issues
Enable reduced motion:
```tsx
// In system preferences or via CSS
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
  }
}
```
