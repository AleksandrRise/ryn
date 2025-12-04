# 🎃 Halloween Theme Components

Transform Ryn's compliance dashboard into a spooky Halloween experience with animated ghosts, haunted visualizations, and satisfying effects.

## Quick Start

### 1. Enable the Theme
```tsx
// In Settings page (already integrated)
import { HalloweenToggle } from "@/components/halloween/HalloweenToggle"

<HalloweenToggle />
```

### 2. Use in Your Components
```tsx
import { HauntedHouse } from "@/components/halloween"

<HauntedHouse
  violations={violations}
  onViolationClick={handleClick}
  isScanning={isScanning}
  scanProgress={progress}
/>
```

## Components

### HauntedHouse
Main container for displaying violations as a haunted mansion.

**Props:**
- `violations: Violation[]` - Array of violations to display
- `onViolationClick?: (violation: Violation) => void` - Click handler
- `isScanning?: boolean` - Whether a scan is in progress
- `scanProgress?: number` - Scan progress (0-100)

**Features:**
- Atmospheric mist effects
- Cobweb decorations
- Spooky stats header
- Integrates HauntingMeter during scans

### SpookyViolationCard
Individual violation displayed as a floating ghost card.

**Props:**
- `violation: Violation` - The violation to display
- `onClick?: () => void` - Click handler
- `index?: number` - For staggered animations

**Severity Styles:**
- **Critical**: Red glow, fast wobble, "Vengeful Spirit"
- **High**: Orange glow, medium wobble, "Restless Ghost"
- **Medium**: Yellow glow, slow drift, "Wandering Spirit"
- **Low**: Blue glow, gentle float, "Faint Whisper"

### HauntingMeter
Spooky progress bar for scan progress.

**Props:**
- `progress: number` - Progress percentage (0-100)

**Features:**
- Ghostly gradient fill
- Floating ghost icons
- Particle effects
- Crystal ball indicator

### BanishGhostAnimation
Satisfying "poof" effect when fixes are applied.

**Props:**
- `isVisible: boolean` - Whether to show the animation
- `onComplete?: () => void` - Callback when animation finishes
- `severity?: "critical" | "high" | "medium" | "low"` - Affects particle colors

**Features:**
- Ghost shrinks and rotates
- Particle explosion
- Ring expansion
- "POOF!" text

### HalloweenToggle
Settings toggle for enabling/disabling the theme.

**Features:**
- Animated switch with emoji
- Sound toggle (when theme is active)
- Smooth transitions
- Persistent state

### BatSwoop
Easter egg - random bat flies across screen.

**Features:**
- Appears every 2-4 minutes
- Smooth bezier animation
- Only when theme is enabled

### PumpkinCursor
Changes cursor to pumpkin on violation hover.

**Features:**
- Dynamic CSS injection
- Auto-cleanup on disable

### HalloweenThemeProvider
Wraps app to provide theme context and easter eggs.

**Usage:**
```tsx
// In app/layout.tsx (already integrated)
<HalloweenThemeProvider>
  {children}
</HalloweenThemeProvider>
```

## Hooks

### useHalloweenTheme
Main theme state management hook.

```tsx
const {
  isEnabled,      // boolean - theme enabled state
  soundEnabled,   // boolean - sound enabled state
  isLoaded,       // boolean - SSR-safe loaded flag
  toggle,         // () => void - toggle theme
  toggleSound,    // () => void - toggle sound
  enable,         // () => void - enable theme
  disable,        // () => void - disable theme
} = useHalloweenTheme()
```

### usePoofEffect
Manages banish ghost animation state.

```tsx
const {
  isPoofing,      // boolean - animation active
  triggerPoof,    // (message?: string) => void - trigger animation
} = usePoofEffect()
```

### useGhostAnimation
Severity-based animation configurations.

```tsx
const {
  animate,        // Framer Motion animate props
  transition,     // Framer Motion transition props
  config,         // Raw config object
} = useGhostAnimation(severity)
```

## Styling

### Color Palette
```css
--halloween-purple: #4B2665;
--halloween-orange: #FF8C00;
--halloween-black: #0a0b10;
--halloween-ghost: #E8E8FF;
--halloween-red: #DC2626;
--halloween-green: #10B981;
```

### Animation Timings
- Ghost drift: 2-5s (severity-dependent)
- Poof effect: 600ms
- Bat swoop: 1.5s
- Haunting meter: 2s

## Accessibility

### Motion Preferences
All animations respect `prefers-reduced-motion`:
```tsx
const shouldReduceMotion = useReducedMotion()
```

### Color Contrast
- WCAG AA compliant
- Critical violations maintain red for urgency
- Healthy states use green for positive association

### Keyboard Navigation
- All interactive elements keyboard accessible
- Focus states preserved
- Screen reader friendly

## Examples

### Basic Integration
```tsx
import { HalloweenScanWrapper } from "@/components/scan/HalloweenScanWrapper"

<HalloweenScanWrapper
  violations={violations}
  onViolationClick={handleClick}
  isScanning={isScanning}
  scanProgress={progress}
>
  {/* Fallback standard UI */}
  <StandardViolationList violations={violations} />
</HalloweenScanWrapper>
```

### Conditional Rendering
```tsx
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

const { isEnabled } = useHalloweenTheme()

{isEnabled ? (
  <SpookyViolationCard violation={v} />
) : (
  <StandardCard violation={v} />
)}
```

### Trigger Poof on Fix
```tsx
import { usePoofEffect } from "@/lib/hooks/usePoofEffect"

const { triggerPoof } = usePoofEffect()

const handleApplyFix = async () => {
  await apply_fix(fixId)
  triggerPoof("Ghost banished!")
}
```

## File Structure

```
components/halloween/
├── HauntedHouse.tsx           # Main container
├── SpookyViolationCard.tsx    # Individual ghost cards
├── HauntingMeter.tsx          # Progress bar
├── BanishGhostAnimation.tsx   # Poof effect
├── HalloweenToggle.tsx        # Settings toggle
├── BatSwoop.tsx               # Easter egg
├── PumpkinCursor.tsx          # Cursor effect
├── HalloweenThemeProvider.tsx # Context provider
├── index.ts                   # Exports
├── README.md                  # This file
└── INTEGRATION_EXAMPLES.md    # Detailed examples

lib/hooks/
├── useHalloweenTheme.ts       # Theme state
├── usePoofEffect.ts           # Animation trigger
├── useGhostAnimation.ts       # Animation configs
└── index.ts                   # Exports

.kiro/
├── specs/halloween-theme.md   # Design spec
└── steering/halloween-ux.md   # UX guidelines
```

## Performance

### Optimizations
- Lazy loading of easter eggs
- Memoized animation configs
- RAF-based particle effects
- Hardware-accelerated transforms
- Conditional rendering

### Bundle Impact
- Core components: ~8KB gzipped
- No additional dependencies
- Framer Motion already in project

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile: ⚠️ Reduced animations recommended

## Testing

Run tests:
```bash
pnpm test components/halloween
```

Check diagnostics:
```bash
pnpm lint
```

## Future Enhancements

- [ ] Sound effects (infrastructure ready)
- [ ] Midnight chime animation
- [ ] Konami code activation
- [ ] More emoji variations
- [ ] Seasonal theme system

## Contributing

When adding new Halloween components:

1. Follow existing naming conventions
2. Respect `prefers-reduced-motion`
3. Maintain WCAG AA contrast
4. Add TypeScript types
5. Include usage examples
6. Update this README

## License

Same as parent project (Ryn).

---

**Happy Haunting! 👻🎃**
