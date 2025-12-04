# Halloween Theme Specification

## Overview
Transform Ryn's compliance dashboard into a spooky Halloween experience with animated ghosts, haunted house visualizations, and satisfying "banish the ghost" effects.

## Color Palette
- **Primary Dark Purple**: `#4B2665` (haunted background)
- **Accent Orange**: `#FF8C00` (pumpkin glow)
- **Deep Black**: `#0a0b10` (midnight)
- **Ghost White**: `#E8E8FF` (spectral)
- **Blood Red**: `#DC2626` (critical violations)
- **Toxic Green**: `#10B981` (healthy/clean)

## Typography
- **Headers**: System font with letter-spacing for eerie effect
- **Body**: Inter (existing)
- **Accent**: Creepster (Google Fonts) for Halloween flavor text

## Animation Timings
- **Ghost Drift**: 3-5s ease-in-out infinite
- **Poof Effect**: 600ms cubic-bezier(0.68, -0.55, 0.265, 1.55)
- **Bat Swoop**: 1.2s ease-in
- **Haunting Meter Fill**: 2s ease-out

## Component Structure

### 1. SpookyViolationCard
- Displays violation as floating ghost
- Severity determines:
  - **Critical**: Intense red glow, fast wobble, sparkles
  - **High**: Orange glow, medium wobble
  - **Medium**: Yellow glow, slow drift
  - **Low**: Pale glow, gentle float
- Hover: Ghost wobbles menacingly
- Click: Opens violation detail

### 2. HauntedHouse
- Grid layout of violations as "haunted rooms"
- Cobweb SVG overlays in corners
- Animated haunting meter bar
- Ghostly particle effects

### 3. BanishGhostAnimation
- Triggered when fix is applied
- Ghost shrinks with rotation
- Particle explosion (purple/orange)
- "Poof" sound effect (optional)
- Success toast with spooky message

### 4. HauntingMeter
- Progress bar during scans
- Fills with ghostly gradient
- Floating ghost icons inside bar
- Pulses on critical violations

## Easter Eggs
1. **Random Creepy Sounds**: Subtle ambient sounds (wind, creaks) - muted by default
2. **Bat Swoosh**: Random bat flies across screen every 2-3 minutes
3. **Pumpkin Cursor**: Cursor becomes pumpkin on hover over violations
4. **Midnight Chime**: Special animation at exactly midnight
5. **Konami Code**: Activates "super spooky mode" with more intense effects

## Theme Toggle
- Persistent localStorage key: `ryn-halloween-mode`
- Settings panel toggle with pumpkin icon
- Smooth transition between normal and Halloween themes (500ms)
- Sound toggle separate from theme toggle

## Accessibility
- All animations respect `prefers-reduced-motion`
- Color contrast meets WCAG AA standards
- Keyboard navigation preserved
- Screen reader friendly labels
