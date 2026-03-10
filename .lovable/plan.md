

# Improve Strict Presentation Mode UX

## Overview
Three improvements to the strict presentation mode:
1. Clearer instructions on the prep screen explaining the flow
2. Nicer word hint appearance using Framer Motion animations (smooth slide-up with blur, scaling)
3. Screen pulse effect when hesitation is detected and a hint is on its way

## Changes

### 1. Clearer Prep Screen Instructions (`src/pages/Presentation.tsx`)
- Rewrite the "How it works" section with a step-by-step flow that feels more like onboarding:
  - Step 1: "Press start and begin speaking your speech from memory"
  - Step 2: "If you hesitate, a gentle hint will appear to help you"  
  - Step 3: "Keep going -- your performance is tracked for review"
- Add a subtle motivational note like "No text on screen. Just you and your words."
- Keep it clean and scannable

### 2. Animated Word Hints (`src/components/StrictPresentationView.tsx`)
- Import `motion` and `AnimatePresence` from `framer-motion`
- Replace the current static hint strip with animated versions:
  - **"Trying" phase**: Slides up softly with a blur-to-clear effect, gentle scale from 0.95 to 1
  - **"Showing" phase**: Word appears with a spring animation, slightly larger initial scale that settles
- Use `AnimatePresence` with `mode="wait"` so transitions between phases are smooth
- Add a subtle backdrop blur behind the hint for better readability

### 3. Screen Pulse During Hesitation (`src/components/StrictPresentationView.tsx`)
- Add a new state: `isHesitating` (boolean) that turns true when the silence timer crosses ~60% of the delay threshold (the "trying" phase trigger)
- When `isHesitating` is true, render a full-screen overlay `motion.div` with:
  - A soft pulsing border/glow effect around the edges of the screen using `animate` with repeating opacity and box-shadow
  - Uses primary color at low opacity (e.g., `hsl(var(--primary) / 0.08)`)
  - Pulses with a ~1.5s cycle
- When the user speaks the word (hint clears), the pulse fades out smoothly
- This gives a visual "the screen is waiting for you" feeling without being intrusive

## Technical Details

### Framer Motion hint animation config
```text
"trying" phase:
  initial: { opacity: 0, y: 20, filter: "blur(8px)", scale: 0.95 }
  animate: { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }
  transition: { duration: 0.4, ease: "easeOut" }

"showing" phase:
  initial: { opacity: 0, scale: 0.8 }
  animate: { opacity: 1, scale: 1 }
  transition: { type: "spring", stiffness: 300, damping: 25 }

exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } }
```

### Screen pulse overlay
```text
Rendered as a fixed inset-0 div with pointer-events-none
animate: {
  boxShadow: [
    "inset 0 0 60px hsl(var(--primary) / 0.05)",
    "inset 0 0 100px hsl(var(--primary) / 0.12)",
    "inset 0 0 60px hsl(var(--primary) / 0.05)"
  ]
}
transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
```

### Files to edit
- `src/pages/Presentation.tsx` -- prep screen instructions
- `src/components/StrictPresentationView.tsx` -- animated hints + screen pulse

