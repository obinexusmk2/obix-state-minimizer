# HTML Element State Minimization

## Every HTML Element is an FSM

The browser renders elements, but the *state* of those elements — whether they
are focused, hovered, disabled, loading, valid, invalid — is a state machine.

`@obinexusltd/obix-state-minimizer` makes that machine explicit, minimizes it,
and maps the result back to the CSS classes and ARIA attributes your component
needs to render.

---

## Button Element States

### The naive model (7 states)

```
default -> hover -> focused -> loading -> disabled -> loadingDisabled -> pressed
```

Rendered CSS classes:

```css
.obix-button                   /* default */
.obix-button:hover             /* hover */
.obix-button:focus-visible     /* focused */
.obix-button--loading          /* loading */
.obix-button--disabled         /* disabled */
.obix-button--loading.obix-button--disabled   /* loadingDisabled */
.obix-button--pressed          /* pressed */
```

### After minimization

The minimizer finds that `disabled` and `loadingDisabled` behave identically:
both block `click`, `focus`, `hover` transitions.

```typescript
import { minimizeFSM } from '@obinexusltd/obix-state-minimizer';

const result = minimizeFSM(buttonFSM);
// result.minimizedStateCount < result.originalStateCount
// result.stateMap.get('disabled') === result.stateMap.get('loadingDisabled')
```

Result: **5 states** instead of 7.

### CSS class map (minimized)

| Minimized state | CSS class | ARIA |
|---|---|---|
| `default` | `.obix-button` | `aria-disabled="false"` |
| `focused` | `.obix-button .obix-button--focused` | `aria-disabled="false"` |
| `loading` | `.obix-button .obix-button--loading` | `aria-busy="true" aria-disabled="true"` |
| `[disabled+loadingDisabled]` | `.obix-button--disabled` | `aria-disabled="true" tabindex="-1"` |
| `pressed` | `.obix-button--pressed` | `aria-pressed="true"` |

One CSS rule covers both disabled cases instead of two. The ARIA output is identical.

---

## Input Element States

### Validation pipeline (naive — 7 states)

```
pristine -> touched -> validating -> valid -> invalid -> invalidFocused -> validTouched
```

### After minimization

`invalid` and `invalidFocused` merge — both render `aria-invalid="true"`.
`valid` and `validTouched` merge — both render `aria-invalid="false"`.

Result: **5 states** instead of 7.

### ARIA attribute map (minimized)

```typescript
// Map minimized state -> ARIA attributes for render(state)
const ariaMap: Record<string, Record<string, string>> = {
  [pristineState]:    { 'aria-invalid': 'false', 'aria-busy': 'false' },
  [touchedState]:     { 'aria-invalid': 'false', 'aria-busy': 'false' },
  [validatingState]:  { 'aria-invalid': 'false', 'aria-busy': 'true'  },
  [validState]:       { 'aria-invalid': 'false', 'aria-busy': 'false' },
  [invalidState]:     { 'aria-invalid': 'true',  'aria-busy': 'false' },
};
```

Fewer states = fewer conditional branches in `render(state)`.

### HTML output before vs after

**Before minimization** — two separate rendering paths:

```html
<!-- invalid state -->
<input aria-invalid="true" aria-describedby="email-error" />

<!-- invalidFocused state — identical output, separate branch -->
<input aria-invalid="true" aria-describedby="email-error" />
```

**After minimization** — one rendering path:

```html
<!-- [invalid+invalidFocused] merged state -->
<input aria-invalid="true" aria-describedby="email-error" />
```

---

## Select / Dropdown States

### States

```
closed -> open -> selecting -> selected -> disabled
```

Events: `click`, `keydown`, `select`, `blur`, `disable`, `enable`

### Minimization result

`closed` after a selection and `closed` at initial state behave identically
on all future inputs — they merge into one state.

```typescript
import { minimizeFSM, buildAST, ASTOptimizer } from '@obinexusltd/obix-state-minimizer';

type DropdownState = 'closed' | 'open' | 'selecting' | 'selected' | 'disabled';
type DropdownEvent = 'click' | 'select' | 'blur' | 'disable' | 'enable';

const result = minimizeFSM(dropdownFSM);
const ast = buildAST(dropdownFSM, result);
console.log(ASTOptimizer.serialize(ast));
```

### CSS class map (minimized)

| Minimized state | CSS | ARIA |
|---|---|---|
| `[closed+selected]` | `.obix-select` | `aria-expanded="false"` |
| `open` | `.obix-select .obix-select--open` | `aria-expanded="true"` |
| `selecting` | `.obix-select .obix-select--open` | `aria-expanded="true" aria-activedescendant="opt-N"` |
| `disabled` | `.obix-select--disabled` | `aria-disabled="true"` |

---

## Modal / Overlay States

### States

```
closed -> opening -> open -> closing -> closed
```

`opening` and `closing` are transient animation states. If the user has
`prefers-reduced-motion: reduce` set, they are skipped entirely — the FSM
reduces to `closed -> open -> closed`.

```typescript
// Reduced-motion FSM (3 states)
type ModalState = 'closed' | 'open' | 'trapped';

// Full FSM (5 states)  
type ModalStateFull = 'closed' | 'opening' | 'open' | 'trapped' | 'closing';
```

The minimizer produces the same reduced result automatically — the transient
states are equivalent to their target states when there are no events that
distinguish them.

---

## Navigation / Tab States

### States

```
idle -> tabFocused -> panelActive -> panelScrolled
```

`panelActive` and `panelScrolled` both render `aria-selected="true"` on the
tab and `role="tabpanel" aria-hidden="false"` on the panel. They merge.

### HTML output (minimized)

```html
<!-- Single merged state: panelActive + panelScrolled -->
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel-1" tabindex="0">Tab 1</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2" tabindex="-1">Tab 2</button>
</div>
<div id="panel-1" role="tabpanel" aria-hidden="false">...</div>
<div id="panel-2" role="tabpanel" aria-hidden="true">...</div>
```

---

## Summary: Minimization Savings by Component

| Component | Original states | Minimized | Merged |
|---|---|---|---|
| Button | 7 | 5 | `disabled + loadingDisabled` |
| Input | 7 | 5 | `invalid + invalidFocused`, `valid + validTouched` |
| Select | 5 | 4 | `closed + selected` |
| Modal | 5 | 3 (reduced-motion) | `opening + open`, `closing + closed` |
| Tabs | 4 | 3 | `panelActive + panelScrolled` |

Each merge eliminates one redundant CSS rule, one duplicate ARIA branch,
and one unnecessary revision entry in the component's state history.
