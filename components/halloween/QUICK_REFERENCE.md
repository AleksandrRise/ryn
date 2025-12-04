# 🎃 Halloween Theme Quick Reference

## 🚀 Quick Start (30 seconds)

### 1. Enable Theme
Settings → Halloween Theme → Toggle ON

### 2. View Demo
Navigate to `/halloween-demo`

### 3. See It Live
Go to Scan page with active project

## 📦 Import Cheat Sheet

```tsx
// Components
import {
  HauntedHouse,
  SpookyViolationCard,
  HauntingMeter,
  BanishGhostAnimation,
  HalloweenToggle,
  BatSwoop,
  PumpkinCursor,
  HalloweenThemeProvider
} from "@/components/halloween"

// Hooks
import {
  useHalloweenTheme,
  usePoofEffect,
  useGhostAnimation
} from "@/lib/hooks"

// Wrapper
import { HalloweenScanWrapper } from "@/components/scan/HalloweenScanWrapper"
```

## 🎨 Component Props

### HauntedHouse
```tsx
<HauntedHouse
  violations={violations}        // Violation[]
  onViolationClick={handleClick} // (v: Violation) => void
  isScanning={false}             // boolean
  scanProgress={0}               // number (0-100)
/>
```

### SpookyViolationCard
```tsx
<SpookyViolationCard
  violation={violation}  // Violation
  onClick={handleClick}  // () => void
  index={0}              // number (for stagger)
/>
```

### HauntingMeter
```tsx
<HauntingMeter
  progress={50}  // number (0-100)
/>
```

### BanishGhostAnimation
```tsx
<BanishGhostAnimation
  isVisible={true}           // boolean
  onComplete={handleDone}    // () => void
  severity="critical"        // "critical" | "high" | "medium" | "low"
/>
```

## 🪝 Hook Usage

### useHalloweenTheme
```tsx
const {
  isEnabled,     // boolean
  soundEnabled,  // boolean
  isLoaded,      // boolean
  toggle,        // () => void
  toggleSound,   // () => void
  enable,        // () => void
  disable        // () => void
} = useHalloweenTheme()
```

### usePoofEffect
```tsx
const {
  isPoofing,   // boolean
  triggerPoof  // (message?: string) => void
} = usePoofEffect()

// Usage
triggerPoof("Ghost banished!")
```

### useGhostAnimation
```tsx
const {
  animate,     // Framer Motion props
  transition,  // Framer Motion props
  config       // Raw config object
} = useGhostAnimation("critical")
```

## 🎯 Common Patterns

### Pattern 1: Conditional Rendering
```tsx
const { isEnabled } = useHalloweenTheme()

{isEnabled ? <SpookyCard /> : <StandardCard />}
```

### Pattern 2: Wrapper Integration
```tsx
<HalloweenScanWrapper violations={violations}>
  <StandardList />
</HalloweenScanWrapper>
```

### Pattern 3: Banish on Fix
```tsx
const { triggerPoof } = usePoofEffect()

const applyFix = async () => {
  await apply_fix(fixId)
  triggerPoof()
}
```

## 🎨 Severity Styles

| Severity | Color | Glow | Duration | Label |
|----------|-------|------|----------|-------|
| critical | Red | Intense | 2s | Vengeful Spirit |
| high | Orange | Medium | 3s | Restless Ghost |
| medium | Yellow | Soft | 4s | Wandering Spirit |
| low | Blue | Pale | 5s | Faint Whisper |

## 🎃 Emoji Reference

```tsx
👻 Ghost (main icon)
🎃 Pumpkin (theme toggle)
💀 Skull (critical)
🏚️ Haunted house (container)
🔮 Crystal ball (scanning)
🦇 Bat (easter egg)
🕸️ Cobweb (decoration)
⚰️ Coffin (future)
🕯️ Candle (future)
🕷️ Spider (future)
```

## 🎨 Color Palette

```css
--purple:  #4B2665  /* Haunted background */
--orange:  #FF8C00  /* Pumpkin glow */
--black:   #0a0b10  /* Midnight */
--ghost:   #E8E8FF  /* Spectral */
--red:     #DC2626  /* Critical */
--green:   #10B981  /* Healthy */
```

## ⚡ Performance Tips

```tsx
// 1. Lazy load
const HauntedHouse = dynamic(() => import("@/components/halloween/HauntedHouse"))

// 2. Memoize
const violations = useMemo(() => filterViolations(), [deps])

// 3. Reduce motion
const shouldReduceMotion = useReducedMotion()
```

## 🐛 Troubleshooting

### Theme not persisting?
```tsx
// Check localStorage
console.log(localStorage.getItem("ryn-halloween-mode"))
```

### Animations not working?
```tsx
// Check Framer Motion
import { motion } from "framer-motion"
```

### Ghosts not appearing?
```tsx
// Verify theme is enabled
const { isEnabled } = useHalloweenTheme()
console.log("Enabled:", isEnabled)
```

## 📁 File Locations

```
components/halloween/     # All components
lib/hooks/               # Theme hooks
.kiro/specs/            # Design specs
.kiro/steering/         # UX guidelines
app/halloween-demo/     # Demo page
```

## 🔗 Quick Links

- [Full Documentation](./README.md)
- [Integration Examples](./INTEGRATION_EXAMPLES.md)
- [Feature Overview](../../HALLOWEEN_FEATURE.md)
- [Implementation Summary](../../HALLOWEEN_IMPLEMENTATION_SUMMARY.md)

## 💡 Pro Tips

1. **Always check `isEnabled`** before rendering Halloween components
2. **Use wrapper pattern** for easy integration
3. **Respect motion preferences** with `useReducedMotion()`
4. **Test with theme on/off** to ensure fallbacks work
5. **Check demo page** for live examples

## 🎓 Learning Path

1. Read [README.md](./README.md) for component API
2. Check [INTEGRATION_EXAMPLES.md](./INTEGRATION_EXAMPLES.md) for patterns
3. Visit `/halloween-demo` for interactive examples
4. Review [HALLOWEEN_FEATURE.md](../../HALLOWEEN_FEATURE.md) for full details

---

**Need help?** Check the full documentation or visit the demo page!

👻 Happy Haunting! 🎃
