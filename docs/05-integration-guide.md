# Integration Guide: obix-state-minimizer + OBIX Components

## The Integration Model

```
OBIX component (state -> action -> render)
           |
           v
   Model states as FSM
           |
           v
   minimizeFSM(fsm)          <-- finds equivalent states
           |
           v
   stateMap: original -> rep  <-- drives CSS classes + ARIA
           |
           v
   render(state) -> HTML      <-- minimal rules, correct output
```

---

## Step 1: Model Your Component States

Start with the complete set of states your component can be in.
Include every state you can think of — the minimizer will eliminate
the redundant ones.

```typescript
// ObixButton: every possible state
type ButtonState =
  | 'default'
  | 'focused'
  | 'hover'
  | 'loading'
  | 'disabled'
  | 'loadingDisabled';  // <- probably redundant

type ButtonEvent =
  | 'focus' | 'blur' | 'hover' | 'unhover'
  | 'click' | 'startLoading' | 'stopLoading'
  | 'disable' | 'enable';
```

---

## Step 2: Define the Transition Table

```typescript
import type { FSM } from '@obinexusltd/obix-state-minimizer';

const buttonFSM: FSM<ButtonState, ButtonEvent> = {
  states:         new Set(['default', 'focused', 'hover', 'loading', 'disabled', 'loadingDisabled']),
  alphabet:       new Set(['focus', 'blur', 'hover', 'unhover', 'click', 'startLoading', 'stopLoading', 'disable', 'enable']),
  initialState:   'default',
  acceptingStates: new Set(['default', 'focused', 'hover']),

  transition(state, event) {
    const t = {
      default:         { focus: 'focused', hover: 'hover', startLoading: 'loading', disable: 'disabled', click: 'default' },
      focused:         { blur: 'default',  startLoading: 'loading', disable: 'disabled', click: 'focused' },
      hover:           { unhover: 'default', focus: 'focused', startLoading: 'loading', disable: 'disabled' },
      loading:         { stopLoading: 'default', disable: 'loadingDisabled' },
      disabled:        { enable: 'default' },
      loadingDisabled: { stopLoading: 'disabled', enable: 'loading' },
    } as const;
    return (t as any)[state]?.[event];
  },
};
```

---

## Step 3: Minimize

```typescript
import { minimizeFSM } from '@obinexusltd/obix-state-minimizer';

const result = minimizeFSM(buttonFSM);

console.log(result.originalStateCount);   // 6
console.log(result.minimizedStateCount);  // 5  (disabled + loadingDisabled merged)
console.log(result.removedStates);        // ['loadingDisabled']
```

---

## Step 4: Build the CSS Class Mapper

```typescript
function getButtonClasses(state: ButtonState): string[] {
  const rep = result.stateMap.get(state)!;
  const disabledRep = result.stateMap.get('disabled')!;
  const loadingRep  = result.stateMap.get('loading')!;

  const classes = ['obix-button'];

  // disabled AND loadingDisabled share the same representative
  if (rep === disabledRep) {
    classes.push('obix-button--disabled');
    return classes;
  }
  if (rep === loadingRep) {
    classes.push('obix-button--loading');
    return classes;
  }

  return classes;
}

// Test:
getButtonClasses('disabled');        // ['obix-button', 'obix-button--disabled']
getButtonClasses('loadingDisabled'); // ['obix-button', 'obix-button--disabled']  <-- same!
getButtonClasses('loading');         // ['obix-button', 'obix-button--loading']
getButtonClasses('default');         // ['obix-button']
```

---

## Step 5: Build the ARIA Attribute Mapper

```typescript
function getAriaAttributes(state: ButtonState): Record<string, string> {
  const { minimized } = result;
  const rep = result.stateMap.get(state)!;
  const isAccepting = minimized.acceptingStates.has(rep);
  const disabledRep = result.stateMap.get('disabled')!;
  const loadingRep  = result.stateMap.get('loading')!;

  if (rep === disabledRep) return { 'aria-disabled': 'true',  'aria-busy': 'false', 'tabindex': '-1' };
  if (rep === loadingRep)  return { 'aria-disabled': 'true',  'aria-busy': 'true',  'tabindex': '-1' };
  if (isAccepting)         return { 'aria-disabled': 'false', 'aria-busy': 'false', 'tabindex': '0'  };
  return                          { 'aria-disabled': 'false', 'aria-busy': 'false', 'tabindex': '0'  };
}
```

---

## Step 6: Wire into OBIX render(state)

```typescript
import { createButton } from '@obinexusltd/obix-component-runtime';

const btn = createButton({ label: 'Save', variant: 'primary' });
let obixState = btn.state;
let currentFsmState: ButtonState = 'default';

function dispatch(event: ButtonEvent): void {
  // Advance the minimized FSM
  const nextFsmState = buttonFSM.transition(currentFsmState, event);
  if (!nextFsmState) return;
  currentFsmState = nextFsmState;

  // Apply OBIX actions based on the transition
  if (event === 'startLoading') obixState = btn.actions.setLoading(obixState, true);
  if (event === 'stopLoading')  obixState = btn.actions.setLoading(obixState, false);
  if (event === 'disable')      obixState = btn.actions.setDisabled(obixState, true);
  if (event === 'enable')       obixState = btn.actions.setDisabled(obixState, false);

  // Render with minimization-derived classes and ARIA
  const classes = getButtonClasses(currentFsmState);
  const aria    = getAriaAttributes(currentFsmState);

  document.getElementById('app')!.innerHTML = btn.render({
    ...obixState,
    className: classes.join(' '),
    ...aria,
  });
}
```

---

## Step 7: Input Sanitization with USCN

Always normalize user input before passing to OBIX form actions:

```typescript
import { createInput } from '@obinexusltd/obix-component-runtime';
import { normalizeInput, isPathSafe } from '@obinexusltd/obix-state-minimizer';

const input = createInput({
  name: 'email',
  type: 'email',
  label: 'Email Address',
  validation: 'blur',
});

let inputState = input.state;

function handleChange(rawValue: string): void {
  // Normalize encoding before dispatching to OBIX
  const { canonical } = normalizeInput(rawValue);
  inputState = input.actions.change(inputState, canonical);
  document.getElementById('email-wrapper')!.innerHTML = input.render(inputState);
}

function handleFileUpload(path: string): boolean {
  // Block path traversal attacks before ObixFileUpload processes the path
  return isPathSafe(path);
}
```

---

## Step 8: Use ObixTrackerB for Lean Revision History

```typescript
import { ObixTrackerB } from './examples/05-component-state-tracker';

const tracker = new ObixTrackerB(btn.state);

function dispatchTracked(event: ButtonEvent): void {
  dispatch(event);
  // Record only meaningful state changes (no NO_OP, no duplicates)
  tracker.record(event as any, obixState);
}

// Undo last meaningful change
function undo(): void {
  const prev = tracker.undo();
  if (prev) {
    obixState = prev;
    document.getElementById('app')!.innerHTML = btn.render(obixState);
  }
}
```

---

## Complete Integration Checklist

```
[ ] Model component states as FSM (Q, Sigma, delta, q0, F)
[ ] Call minimizeFSM(fsm) to find equivalent states
[ ] Build getCSSClasses(state) from stateMap
[ ] Build getAriaAttributes(state) from stateMap + acceptingStates
[ ] Normalize user input with normalizeInput() before OBIX actions
[ ] Validate file paths with isPathSafe() before ObixFileUpload
[ ] Use ObixTrackerB for production revision history
[ ] Use ObixTrackerA for debug/telemetry mode
[ ] Build ObixHTMLTokenizer from BaseTokenizer for post-render ARIA checks
[ ] Run npm test to verify 28/28 pass after any changes
```
