# 03 — Neumorphic 3D Design System

> Maps to PRD section 6.
> **When to read:** Before building any UI component. By every designer and every front-end engineer.

Every interactive surface in this product uses **Neumorphism** — soft inner and outer shadows that simulate a pressable surface extruded from the background. We avoid hard borders; depth is communicated entirely through light and shadow.

This document is the **single source of truth** for tokens, component states, and accessibility rules. The implementation lives in `packages/ui`.

---

## 1. Core philosophy

| Principle | What it means in practice |
|---|---|
| Depth, not lines | No `border: 1px` anywhere. Separation is via shadow. |
| Pressable everywhere | Every interactive element shows a clear pressed state (inner shadow + scale + haptic). |
| Light defines depth | A single light source (top-left) is consistent across the whole app. |
| Calm motion | All state transitions are springs — never CSS easing curves. |
| Accessible by default | A user with reduced-motion or high-contrast preferences sees a clean, WCAG-AA version. |

---

## 2. Design tokens

Tokens are exported from `packages/ui/theme/tokens.ts` and consumed by every component. **Engineers must never hard-code these values inline.**

### 2.1 Colours

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `bg.base` | `#E8ECF2` | `#1A1D24` | Page background — the "raised from" surface |
| `bg.surface` | `#EDF1F7` | `#22262F` | Card / button surface |
| `bg.surface.pressed` | `#E0E4EB` | `#1E2128` | Pressed inner shadow target |
| `text.primary` | `#1A1D24` | `#E8ECF2` | Body and headers |
| `text.secondary` | `#5C6275` | `#A0A6B8` | Captions, hints |
| `text.disabled` | `#9BA1B0` | `#6A6F7E` | Disabled labels |
| `accent.primary` | `#6D28D9` | `#A78BFA` | Brand violet — primary action |
| `accent.success` | `#16A34A` | `#4ADE80` | Streaks, completion |
| `accent.warning` | `#D97706` | `#FBBF24` | Quiet hours toggle, snoozes |
| `accent.danger` | `#DC2626` | `#F87171` | Destructive actions, errors |

### 2.2 Shadows

| Token | Light value | Dark value | Used for |
|---|---|---|---|
| `shadow.outer.lt` | `rgba(255,255,255,0.9)` | `rgba(255,255,255,0.04)` | Top-left highlight (outer) |
| `shadow.outer.dk` | `rgba(28,40,75,0.12)` | `rgba(0,0,0,0.55)` | Bottom-right shadow (outer) |
| `shadow.inner.lt` | inset top-left highlight | inset darker rim | Pressed inner (top-left) |
| `shadow.inner.dk` | inset bottom-right shadow | inset lighter rim | Pressed inner (bottom-right) |

Every elevated surface uses **two outer shadows simultaneously** — the `lt` (top-left) and the `dk` (bottom-right). This is the cornerstone of the visual language; remove either and the depth illusion collapses.

### 2.3 Elevation levels

| Level | Y-offset | Blur | Used for |
|---|---|---|---|
| `elevation.0` | 0 | 0 | Flat (rare, only inset states) |
| `elevation.1` | 2 | 6 | Subtle: chips, badges |
| `elevation.2` | 6 | 18 | Default rest state for buttons, cards |
| `elevation.3` | 10 | 26 | Hover/focus |
| `elevation.4` | 14 | 36 | Floating modals, sheets |

In dark mode, the shadow opacities scale up (darker shadow on darker bg requires more contrast).

### 2.4 Radius

| Token | Value | Used for |
|---|---|---|
| `radius.sm` | 12 | Inputs, chips |
| `radius.md` | 16 | Buttons, toggles |
| `radius.lg` | 22 | Cards, task tiles |
| `radius.xl` | 28 | Hero cards, modal sheets |
| `radius.pill` | 999 | Pill buttons, badges |
| `radius.circle` | 50% | Avatars, progress rings |

### 2.5 Spacing

8-point grid throughout. Tokens: `space.0` (0), `space.1` (4), `space.2` (8), `space.3` (12), `space.4` (16), `space.5` (24), `space.6` (32), `space.7` (48), `space.8` (64).

### 2.6 Typography

| Token | Family | Size / line-height | Weight |
|---|---|---|---|
| `font.display` | Inter | 32 / 40 | 700 |
| `font.h1` | Inter | 26 / 34 | 700 |
| `font.h2` | Inter | 22 / 30 | 600 |
| `font.h3` | Inter | 18 / 26 | 600 |
| `font.body` | Inter | 16 / 24 | 400 |
| `font.body.medium` | Inter | 16 / 24 | 500 |
| `font.caption` | Inter | 13 / 18 | 500 |
| `font.mono` | JetBrains Mono | 14 / 22 | 400 |

Inter is loaded via `expo-font`; weights 400/500/600/700 are required.

### 2.7 Motion (preview — full spec in [`04-motion.md`](04-motion.md))

| Token | Damping | Stiffness | Used for |
|---|---|---|---|
| `motion.spring.gentle` | 24 | 160 | Section reveals, list stagger |
| `motion.spring.default` | 18 | 220 | Buttons, modals (PRD-pinned values) |
| `motion.spring.snappy` | 14 | 320 | Toggles, haptic confirmations |
| `motion.duration.fast` | — | — | 180ms (for non-spring opacity fades only) |
| `motion.duration.normal` | — | — | 320ms |

All spring values flow through Reanimated's `withSpring`. **No CSS easing.**

---

## 3. Component states (button as canonical example)

Every interactive primitive implements these five states. Other components inherit the pattern.

| State | Visual | Motion | Haptic |
|---|---|---|---|
| **Rest** | Outer dual-shadow (`lt` + `dk`), `elevation.2` | — | — |
| **Hover / focus** | `elevation.3`, subtle scale 1.02 | `withSpring(motion.spring.default)` | — |
| **Pressed** | Inner shadow active, `elevation.0`, scale 0.98 | same spring | `Haptics.impactAsync(Medium)` |
| **Disabled** | Shadows flattened by 60%, label desaturated to `text.disabled` | instant | — |
| **Loading** | Inner shadow active + spinner; label hidden | spinner rotation worklet | — |

The label colour never changes between states (only opacity for disabled). This keeps the brand voice consistent.

---

## 4. Neumorphic component inventory

Every component lives in `packages/ui/neu/`. The exhaustive list:

| Component | Purpose | Notes |
|---|---|---|
| `NeuButton` | Primary tappable surface | Accepts `variant: 'primary' \| 'secondary' \| 'ghost' \| 'danger'` |
| `NeuCard` | Container with depth | Used for task tiles, book covers, stat cards |
| `NeuToggle` | iOS-style switch, but pressed instead of slid | Inner shadow track + raised thumb |
| `NeuRing` | Circular progress | Daily progress ring on home tab |
| `NeuSlider` | Horizontal slider | Font size, line spacing in reader |
| `NeuInput` | Text input | Inset Neumorphic well |
| `NeuChip` | Selectable tag | Categories, tags, filters |
| `NeuTabBar` | Bottom tab bar | Active tab is "pressed" |
| `NeuBadge` | Notification count | Pill on bell icon |
| `NeuSheet` | Bottom sheet | Modal that springs up from below |
| `NeuFAB` | Floating action button | + button on today tab |
| `NeuAvatar` | Round image | User avatars, book covers |
| `NeuDivider` | Soft horizontal break | Faint inset line — not a true border |

Each component:

- Is built on `react-native-reanimated` for animated styles.
- Exposes a `testID` prop for E2E.
- Exposes `accessibilityRole` and `accessibilityLabel`.
- Has a Storybook story (`*.stories.tsx`) with every state.
- Has a `*.test.tsx` covering rest/pressed/disabled at minimum.

---

## 5. Accessibility

Neumorphism is beautiful but has a known weakness: low-contrast surfaces. The design system mitigates this with three layered protections.

### 5.1 High-contrast theme

A third theme (`high-contrast`) replaces shadow-based depth with explicit borders:

| Token | High-contrast value |
|---|---|
| `shadow.outer.*` | `transparent` |
| `shadow.inner.*` | `transparent` |
| `border.default` | `2px solid text.primary` |
| `border.focus` | `3px solid accent.primary` |

The high-contrast theme is opt-in in Settings and is automatically selected when the OS reports `AccessibilityInfo.isHighTextContrastEnabled()` (Android) or `UIAccessibility.isDarkerSystemColorsEnabled` (iOS).

### 5.2 Reduced motion

Every animation site reads `useReducedMotion()` from Reanimated. When true:

- Spring animations become instant state changes.
- Scroll-triggered effects (parallax, blur) are disabled.
- Stagger delays collapse to 0.
- Page-curl in the reader becomes a simple opacity crossfade.

### 5.3 Touch targets

Minimum 44 × 44 pt on iOS, 48 × 48 dp on Android, per platform HIGs. Components enforce this via internal `minWidth`/`minHeight`, not via the parent layout.

### 5.4 Labels

Every interactive component has `accessibilityRole` (`button`, `switch`, `slider`, `link`) and a descriptive `accessibilityLabel`. Icon-only buttons must include a label — no exceptions.

### 5.5 Focus order

Expo Router screens declare focus order via `accessibilityElementsHidden` and `importantForAccessibility="yes"`. Modal sheets trap focus while open.

---

## 6. Theming infrastructure

### 6.1 Theme provider

```
<ThemeProvider value={themeName /* 'light' | 'dark' | 'high-contrast' */}>
  <App />
</ThemeProvider>
```

The theme name is persisted in MMKV and seeded from the OS appearance setting on first launch.

### 6.2 Token consumption

Components consume tokens via the `useTheme()` hook, not via direct imports. This makes runtime theme switching free (no re-mount).

### 6.3 Dark mode parity

Every token in section 2 has a light **and** dark value. The system has zero hard-coded colours.

---

## 7. Worked examples

### 7.1 NeuButton (primary, rest state)

```
background: bg.surface
shadows: [shadow.outer.lt at offset (-4,-4) blur 12,
          shadow.outer.dk at offset (4, 4) blur 12]
radius: radius.md (16)
padding: space.3 (12) vertical, space.4 (16) horizontal
text: font.body.medium, color text.primary
```

### 7.2 NeuButton (pressed state)

```
background: bg.surface.pressed
shadows: [shadow.inner.dk inset offset (-3,-3) blur 8,
          shadow.inner.lt inset offset ( 3, 3) blur 8]
transform: scale(0.98)
haptic: impactAsync(Medium)
```

### 7.3 NeuCard (resting task tile)

```
background: bg.surface
shadows: [shadow.outer.lt at offset (-6,-6) blur 18,
          shadow.outer.dk at offset (6, 6) blur 18]
radius: radius.lg (22)
padding: space.4 (16)
```

The exact React Native `Animated.View` implementation lives in `packages/ui/neu/NeuButton.tsx` and `NeuCard.tsx`. Storybook stories demonstrate every variant.

---

## 8. Visual QA checklist (run per release)

Before merging UI changes:

- [ ] Component renders cleanly in light, dark, and high-contrast themes.
- [ ] Pressed state fires a haptic on physical device.
- [ ] Reduced-motion path is visually correct (no broken layouts).
- [ ] Touch target ≥ 44pt / 48dp.
- [ ] `accessibilityLabel` present on every interactive element.
- [ ] Storybook story added/updated.
- [ ] No inline shadows or colours — only token references.

---

## Next reading

- **How it moves** → [`04-motion.md`](04-motion.md)
- **How the mobile codebase organises this** → [`11-frontend-architecture.md`](11-frontend-architecture.md)
