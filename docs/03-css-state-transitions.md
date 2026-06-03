# CSS State Transitions and Minimization

## CSS is a State Machine

CSS pseudo-classes are state observations on an element's FSM:

| CSS pseudo-class | FSM state |
|---|---|
| `:default` | initial / resting state |
| `:hover` | pointer over element |
| `:focus-visible` | keyboard focus |
| `:active` | pressed / active |
| `:disabled` | disabled state |
| `:checked` | checked (input, switch) |
| `:valid` | validation passing |
| `:invalid` | validation failing |
| `[aria-expanded="true"]` | open / expanded |
| `[aria-busy="true"]` | loading |

The browser manages these transitions automatically. But **component-level**
state — `loading`, `loadingDisabled`, `invalidFocused`, etc. — must be
managed explicitly via CSS classes.

`@obinexusltd/obix-state-minimizer` minimizes those component-level states
so you write the minimum number of CSS rules.

---

## Before Minimization: Redundant CSS

```css
/* 7 rules for ObixButton — naive */
.obix-button                           { /* default */ }
.obix-button:hover                     { /* hover */ }
.obix-button:focus-visible             { /* focused */ }
.obix-button--loading                  { /* loading */ }
.obix-button--disabled                 { /* disabled */ }
.obix-button--loading.obix-button--disabled { /* loadingDisabled — REDUNDANT */ }
.obix-button--pressed                  { /* pressed */ }
```

`.obix-button--loading.obix-button--disabled` is redundant because
it produces the same visual and ARIA output as `.obix-button--disabled`.

---

## After Minimization: Canonical CSS

```css
/* 5 rules for ObixButton — minimized */
.obix-button                  { cursor: pointer; }
.obix-button:hover            { background: var(--obix-primary-hover); }
.obix-button:focus-visible    { outline: 2px solid var(--obix-focus-ring); }
.obix-button--loading         { cursor: wait; }
.obix-button--disabled        {
  cursor: not-allowed;
  opacity: 0.5;
  pointer-events: none;
}
/* [aria-disabled="true"] covers BOTH disabled and loadingDisabled */
.obix-button[aria-disabled="true"] {
  pointer-events: none;
  tabindex: -1;
}
```

The ARIA attribute `aria-disabled="true"` is set by the merged state handler —
one line of TypeScript drives both CSS and ARIA simultaneously.

---

## CSS Transition Strategy (from OBIX jfix.scss)

OBIX uses three CLS-safe hover strategies. The minimized FSM tells you which
strategy to apply per state:

### Strategy 1: Transform (hover / focused)

Applied when FSM is in an *accepting* interactive state:

```css
.obix-button:not([aria-disabled="true"]):hover {
  transform: scale(1.02);
  transition: transform 0.2s ease-out;
}
```

### Strategy 2: Box Shadow (elevation on active)

Applied when FSM transitions through `pressed`:

```css
.obix-button:active {
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);
  transform: scale(0.98);
}
```

### Strategy 3: Color Shift (loading state)

Applied when FSM enters `loading`:

```css
.obix-button--loading {
  background: color-mix(in srgb, var(--obix-primary) 70%, white);
  transition: background-color 0.15s ease-out;
}
```

---

## Minimization-Driven CSS Class Generator

The minimized FSM's state map tells you exactly which CSS classes to apply
for any state:

```typescript
import { minimizeFSM } from '@obinexusltd/obix-state-minimizer';

const result = minimizeFSM(buttonFSM);

// Build a CSS class mapper from the minimized state map
function getCSSClasses(originalState: ButtonState): string[] {
  const minState = result.stateMap.get(originalState);
  const isAccepting = result.minimized.acceptingStates.has(minState!);

  const classes = ['obix-button'];

  // One handler covers disabled AND loadingDisabled (they share a representative)
  const disabledRep = result.stateMap.get('disabled');
  if (minState === disabledRep) {
    classes.push('obix-button--disabled');
    return classes;
  }

  if (originalState === 'loading') classes.push('obix-button--loading');
  if (originalState === 'pressed') classes.push('obix-button--pressed');

  return classes;
}

// Usage:
getCSSClasses('disabled');        // ['obix-button', 'obix-button--disabled']
getCSSClasses('loadingDisabled'); // ['obix-button', 'obix-button--disabled'] — same!
getCSSClasses('loading');         // ['obix-button', 'obix-button--loading']
getCSSClasses('default');         // ['obix-button']
```

---

## Input Validation CSS

### Before minimization (7 CSS rules)

```css
.obix-input                      { /* pristine */ }
.obix-input--touched             { /* touched */ }
.obix-input--validating          { /* validating */ }
.obix-input--valid               { /* valid */ }
.obix-input--valid-touched       { /* validTouched — REDUNDANT with valid */ }
.obix-input--invalid             { /* invalid */ }
.obix-input--invalid-focused     { /* invalidFocused — REDUNDANT with invalid */ }
```

### After minimization (5 CSS rules)

```css
.obix-input                 { border: 1px solid var(--obix-border); }
.obix-input--touched        { border-color: var(--obix-gray-400); }
.obix-input--validating     { border-color: var(--obix-info); }

/* One rule covers valid AND validTouched */
.obix-input[aria-invalid="false"]:not(.obix-input--touched):not(.obix-input--validating) {
  border-color: var(--obix-success);
}

/* One rule covers invalid AND invalidFocused */
.obix-input[aria-invalid="true"] {
  border-color: var(--obix-danger);
  background: color-mix(in srgb, var(--obix-danger) 5%, white);
}
```

ARIA-driven CSS means the minimized state automatically drives the right visual output.

---

## Reduced Motion: FSM-Aware Transitions

When `prefers-reduced-motion: reduce` is detected, animation states
(`opening`, `closing`) collapse into their endpoints.

The minimizer handles this automatically when you build the reduced-motion FSM:

```typescript
import { minimizeFSM } from '@obinexusltd/obix-state-minimizer';
import type { FSM } from '@obinexusltd/obix-state-minimizer';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Full FSM (5 states: closed, opening, open, closing, trapped)
// Reduced FSM (3 states: closed, open, trapped)
const modalFSM = prefersReducedMotion ? reducedModalFSM : fullModalFSM;

const result = minimizeFSM(modalFSM);
// result.minimizedStateCount = 3 (reduced) or 4 (full, after minimization)
```

CSS then only needs to handle the states the minimizer tells it exist:

```css
/* Full animation */
@media (prefers-reduced-motion: no-preference) {
  .obix-modal--opening  { animation: fadeIn 0.2s ease-out; }
  .obix-modal--closing  { animation: fadeOut 0.2s ease-in; }
}

/* Reduced motion: opening/closing states don't exist in minimized FSM */
@media (prefers-reduced-motion: reduce) {
  .obix-modal { transition: none; }
}
```

---

## Summary

The CSS minimization workflow:

```
Define component FSM
        |
        v
minimizeFSM(fsm)           <-- Myhill-Nerode partition refinement
        |
        v
stateMap: original -> representative
        |
        v
getCSSClasses(state)        <-- one function, covers all merged states
        |
        v
render(state) -> HTML       <-- minimum CSS rules, correct ARIA
```

The result is a component stylesheet where every rule corresponds to a
*genuinely distinct* component behaviour. No dead rules. No redundant
`aria-invalid` branches. No duplicate event guards.
