# obix-state-minimizer — Examples

Concrete integration examples showing how `@obinexusltd/obix-state-minimizer`
works alongside `@obinexusltd/obix-component-runtime`.

## Running an example

```bash
cd obix-state-minimizer
npm run build
npx ts-node examples/01-component-lifecycle-fsm.ts
```

Or with tsx (no build step):

```bash
npx tsx examples/01-component-lifecycle-fsm.ts
```

---

## Example Index

### 01 — Component Lifecycle FSM
**File:** `01-component-lifecycle-fsm.ts`

Models the OBIX component lifecycle (`CREATED -> UPDATED -> HALTED -> DESTROYED`)
as a formal FSM and runs Myhill-Nerode minimization on it. Shows which lifecycle
states are behaviourally equivalent and builds the optimized AST.

Key APIs: `minimizeFSM`, `buildAST`, `getASTMetrics`, `ASTOptimizer.serialize`

```
CREATED -> dispatch -> UPDATED -> halt -> HALTED -> resume -> UPDATED -> destroy -> DESTROYED
```

---

### 02 — Button State Machine
**File:** `02-button-state-machine.ts`

Models `ObixButton` states (`default | focused | loading | disabled | loadingDisabled`)
as an FSM. The minimizer discovers that `disabled` and `loadingDisabled` are equivalent
(both reject user interaction) and merges them — eliminating a redundant state handler.

Key APIs: `minimizeFSM`, `buildAST`

```
Practical result: one action handler for both "disabled" states instead of two.
```

---

### 03 — Form Validation FSM
**File:** `03-form-validation-fsm.ts`

Models `ObixInput` validation states (`pristine | touched | validating | valid | invalid | ...`)
and shows how the minimizer collapses `invalid` + `invalidFocused` (same ARIA output)
and `valid` + `validTouched`. Maps minimized states to ARIA attributes for rendering.

Key APIs: `minimizeFSM`, `buildAST`, `ASTOptimizer.serialize`

```
ARIA mapping: accepting states -> aria-invalid="false"
              non-accepting    -> aria-invalid="true"
```

---

### 04 — USCN Input Sanitizer
**File:** `04-uscn-input-sanitizer.ts`

Applies the Unicode-Only Structural Charset Normalizer (USCN) to sanitize user input
before passing it to OBIX form actions or the server. Covers:
- Text input normalization (percent-encoding, homoglyphs)
- File upload path safety (`ObixFileUpload`)
- Search query normalization (`ObixSearch`, `ObixAutocomplete`)

Security invariant: `validate(normalize(s)) === validate(canonical(s))`

Key APIs: `USCNormalizer`, `normalizeInput`, `isPathSafe`

---

### 05 — Component State Tracker
**File:** `05-component-state-tracker.ts`

Implements the TennisTracker Program A/B pattern for OBIX component revisions:

- **`ObixTrackerA`** (exhaustive): records every action including no-ops.
  Equivalent to `btn.revisions` with `maxRevisions: Infinity`.
- **`ObixTrackerB`** (minimal): skips epsilon (NO_OP) transitions and duplicate states.
  Lean, undo-capable history for production use.

Key concept: epsilon elimination from OBIX revision tracking.

---

### 06 — HTML Output Tokenizer
**File:** `06-html-output-tokenizer.ts`

Implements `ObixHTMLTokenizer` extending `BaseTokenizer` to tokenize the HTML
strings that OBIX `render(state)` produces. Enables:
- Post-render FUD policy validation (verify ARIA attributes present)
- HTML diffing between state transitions
- Testing render output without a browser

Key APIs: `BaseTokenizer`, `TokenBase`, `TokenizerResult`

---

## OBIX + State Minimizer — Integration Map

```
@obinexusltd/obix-component-runtime          @obinexusltd/obix-state-minimizer
─────────────────────────────────────────    ──────────────────────────────────
createButton(config)                   ───>  minimizeFSM(buttonFSM)
  .state                                       drives: which states to merge
  .actions.setLoading(state, true)             drives: which actions map to same handler
  .render(state) -> HTML string          ───>  BaseTokenizer / ObixHTMLTokenizer
                                                 post-render ARIA validation

createInput(config)                    ───>  minimizeFSM(validationFSM)
  .actions.blur(state)                         drives: aria-invalid, aria-busy mapping
  .actions.change(state, value)         ───>  USCNormalizer.normalize(value)
                                                 sanitize before action dispatch

ObixRuntime.revisions                  ───>  ObixTrackerB (epsilon-free)
  btn.undo()                                   lean revision history

FUD policies (applyAllFudPolicies)     ───>  ObixHTMLTokenizer
  applyAccessibilityPolicy                     post-render policy verification
  applyTouchTargetPolicy
```

---

## Theoretical basis

The integration is grounded in the formal model from:

> Okpala, N.M. (2024). *Automaton State Minimization and AST Optimization*.
> OBINexus Computing Technical Report.

The OBIX state machine (`state -> action -> render`) is a DFA.
The state minimizer reduces it to the smallest equivalent machine —
eliminating redundant component states, action handlers, and revision entries.
