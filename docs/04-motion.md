# 04 — Motion & Scroll-Triggered Animations

> Maps to PRD section 7.
> **When to read:** Phase 4 (week 6) and any time a new animated surface is being designed.

This document defines **every** kind of motion in the app — what triggers it, what changes, what curve drives it, and how it falls back when motion is reduced. The implementation lives in `packages/ui/motion/` and `apps/mobile/src/components/motion/`.

---

## 1. Why Reanimated + Moti

Framer Motion is the gold standard on the web; the closest React Native equivalent is **Reanimated 3** (worklets running on the UI thread at 60-120fps) wrapped by **Moti** (which exposes a Framer-Motion-style `from / animate / exit / transition` API on top of Reanimated).

We use both because:

- **Reanimated** gives us shared values, worklets, and `useAnimatedScrollHandler` — the only way to drive scroll-bound effects without dropping frames.
- **Moti** wraps the common cases (mount/unmount, hover, exit) in a declarative API that reads well in product code.
- **react-native-skia** is reserved for the few effects that genuinely need a canvas (the reader page-curl in particular).

Anything we cannot do with these three is a flag to reconsider the effect, not the toolkit.

---

## 2. Motion vocabulary

### 2.1 Springs

We standardise on three springs. Custom values are forbidden unless added to this document.

| Token | Damping | Stiffness | Feel | Used for |
|---|---|---|---|---|
| `gentle` | 24 | 160 | Slow settle | Section reveals, list stagger, modal scale-in |
| `default` | 18 | 220 | Crisp | Buttons, toggles, sheets (PRD-pinned) |
| `snappy` | 14 | 320 | Bouncy | Haptic confirmations, success states |

These tokens live in `packages/ui/theme/motion.ts` and are imported as named constants — never inlined.

### 2.2 Durations (for non-spring fades only)

| Token | ms | Used for |
|---|---|---|
| `fast` | 180 | Opacity-only fades (toasts, skeleton swaps) |
| `normal` | 320 | Section title fade-in companion to slide-up |
| `slow` | 540 | Hero reveals on cold launch |

---

## 3. Scroll-triggered patterns

These are the marquee motion effects. Every one is implemented in a reusable wrapper component in `packages/ui/motion/`.

| Surface | Trigger | Effect | Wrapper component |
|---|---|---|---|
| Home hero | Vertical scroll 0 → 200dp | Title scales `1 → 0.85`, opacity `1 → 0.4`, background blur `0 → 12` | `<ScrollHero />` |
| Section titles | Element enters viewport | Slide-up 24dp + fade-in (gentle spring, ~320ms) | `<FadeInOnScroll />` |
| Task tiles | List scroll | Stagger 60ms; shadow grows on snap | `<StaggerList />` |
| Streak flame | Tab switch | Shared-element transition; flame morphs across screens | `<SharedFlame />` |
| Book cover grid | Pull-to-refresh | Parallax y-translate `-20 → 0` with elastic spring | `<ParallaxRefresh />` |
| Reader chapter | Page swipe | Skia-rendered 3D page-curl with shadow | `<PageCurl />` |
| Modal sheets | Open / close | Spring scale `0.92 → 1`; backdrop opacity `0 → 0.4` | `<NeuSheet />` |
| Bell badge | New notification | Punch-out scale `1 → 1.3 → 1` with haptic | `<BadgePulse />` |
| Daily ring | Completion change | Progress arc animates with gentle spring; flame burst at 100% | `<NeuRing />` |
| Heatmap cell | Day taps | Inner shadow press → ring pulse | inside `<NeuCard />` |

---

## 4. Implementation rules

These are non-negotiable. Reviewer rejects PRs that violate them.

### 4.1 Worklets only

- All scroll handlers use `useAnimatedScrollHandler`. **Never** `onScroll` with `useState`.
- All animated styles use `useAnimatedStyle`. **Never** the JS-thread `Animated.View`.
- Worklets read from shared values, never from React state.

```ts
// ✓ correct
const scrollY = useSharedValue(0);
const onScroll = useAnimatedScrollHandler((e) => {
  scrollY.value = e.contentOffset.y;
});
const titleStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY.value, [0, 200], [1, 0.4], Extrapolate.CLAMP),
  transform: [{ scale: interpolate(scrollY.value, [0, 200], [1, 0.85]) }],
}));
```

```ts
// ✗ wrong — React state in a scroll callback
const [y, setY] = useState(0);
<ScrollView onScroll={(e) => setY(e.nativeEvent.contentOffset.y)} />
```

### 4.2 Reduced motion is a gate, not a polish task

Every animation site reads `useReducedMotion()` and provides a fallback path **as part of the same PR** that introduces the animation. No "we'll add the fallback later" — that work never gets done.

```ts
const reduced = useReducedMotion();
const style = useAnimatedStyle(() => ({
  opacity: reduced ? 1 : withSpring(visible ? 1 : 0, springs.default),
}));
```

For scroll-bound effects, the fallback typically disables the effect entirely (e.g., hero stays at full opacity, blur stays at 0).

### 4.3 Defer heavy work

After a navigation transition or modal open, schedule heavy work (large list mount, image decode, network fetch) with `InteractionManager.runAfterInteractions()` so animations finish at 60fps.

### 4.4 Shared element transitions

Use Reanimated's `SharedTransition` API. Tag matching components with `sharedTransitionTag` on both screens. The transition runs automatically on navigation.

### 4.5 No layout animations on lists

`LayoutAnimation` and `withLayout` cause re-flows that interact badly with `FlatList`. Use entering/exiting animations (Reanimated's `Layout`, `FadeIn`, `SlideInUp`) instead.

### 4.6 Performance budget per surface

Each animated screen has a perf budget enforced by `reassure`:

| Screen | Max re-renders / interaction | Max script time / frame |
|---|---|---|
| Home / today | 5 | 6ms |
| Reader | 3 (per page swipe) | 8ms |
| Library grid | 10 (per scroll page) | 6ms |
| Modal sheet open | 4 | 5ms |

Budgets are checked on every PR via `pnpm reassure`. A regression of more than 10% blocks merge.

---

## 5. The Skia page-curl in detail

The reader's page-curl is the only effect that needs a canvas. It lives in `apps/mobile/src/components/reader/PageCurl.tsx` and uses `@shopify/react-native-skia`.

- **Geometry:** The next page is rendered to an off-screen Skia surface. The curl is a Bezier transform applied per-pixel via a shader; the curl angle is driven by `scrollX.value`.
- **Shadow:** A second pass renders a soft shadow on the curled face.
- **Performance:** Throttle the redraw to 60Hz; cap at 30Hz when battery saver is on.
- **Fallback:** When `useReducedMotion()` is true, swap to a simple opacity crossfade (`withTiming(1, { duration: 180 })`).

The full shader and geometry math are documented inline in the source.

---

## 6. Motion choreography rules

When multiple elements animate together (e.g., onboarding screen entry), they follow these conventions to feel coherent:

- **Stagger** sibling elements by 60ms (`StaggerList` does this for you).
- **Hierarchy:** Largest/topmost elements animate first.
- **Duration:** Springs do not have an explicit duration, but they should "settle" in roughly 320-540ms. If a spring takes longer, increase stiffness.
- **Direction:** Slide-ups (Y -24 → 0) for content entering from below, slide-downs for headers, fade-only for opacity-only changes.

---

## 7. Anti-patterns (real examples to avoid)

| Don't | Do | Why |
|---|---|---|
| Animate `height` | Animate `transform: scaleY` | `height` triggers layout; transforms don't |
| Animate `marginTop` | Animate `transform: translateY` | Same reason |
| Use `setTimeout` to chain animations | `withSequence` and `withDelay` | Worklet-native, runs on UI thread |
| Recompute spring config inside `useAnimatedStyle` | Import the spring token constant | Worklet hoists the constant once |
| Trigger haptics inside a worklet | Use `runOnJS(Haptics.impactAsync)` | Native modules must be called on JS thread |
| Animate opacity AND scale on a `View` with `borderWidth` | Use shadow tokens (no borders) | Borders cause sub-pixel artefacts during scale |

---

## 8. Motion review checklist (per PR)

- [ ] Uses Reanimated worklets, not the JS `Animated` API.
- [ ] Reads `useReducedMotion()` and provides a fallback.
- [ ] Uses a named spring token (`gentle` / `default` / `snappy`) — no inline config.
- [ ] Heavy follow-up work is wrapped in `InteractionManager`.
- [ ] Reassure budget is unchanged or improved.
- [ ] Storybook story for the wrapper (if shared) shows reduced-motion mode.
- [ ] Haptics fire via `runOnJS` and only on user-initiated interactions.

---

## 9. Where each pattern is used

| Pattern | First appears in phase | Screens |
|---|---|---|
| `ScrollHero` | 4 | Home today |
| `FadeInOnScroll` | 4 | Home, Library, Stats |
| `StaggerList` | 2 | Home today, Library |
| `SharedFlame` | 4 | Home → Stats |
| `ParallaxRefresh` | 6 | Library |
| `PageCurl` | 5 | Reader |
| `NeuSheet` | 1 | every modal |
| `BadgePulse` | 7 | header bell |

---

## Next reading

- **What's animating** → [`03-design-system.md`](03-design-system.md)
- **What surfaces these motions appear on** → [`11-frontend-architecture.md`](11-frontend-architecture.md)
- **Perf targets** → [`17-non-functional.md`](17-non-functional.md)
