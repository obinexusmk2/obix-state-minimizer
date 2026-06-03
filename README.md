# @obinexusltd/obix-state-minimizer

> Minimize HTML/CSS component element state transitions using formal automaton
> theory. Part of the [OBIX](https://github.com/obinexusmk2/obix) ecosystem.

**Author:** Nnamdi Michael Okpala  
**Org:** OBINexus Computing — [@obinexusmk2](https://github.com/obinexusmk2)  
**Support:** support@obinexus.org  
**License:** MIT

---

## What This Library Does

Every interactive HTML element — a button, an input, a dropdown — is a
**finite state machine (FSM)**. Its states (`default`, `loading`, `disabled`,
`invalid`, ...) change in response to user events (`click`, `blur`, `focus`, ...).

Naively modelled, these machines contain **redundant states** — states that
behave identically and produce the same HTML and ARIA output. Redundant states
mean redundant CSS rules, redundant ARIA branches, and redundant revision entries.

This library applies **Myhill-Nerode partition refinement** to find and eliminate
those redundant states, producing the minimal equivalent state machine. The result
drives which CSS classes to apply, which ARIA attributes to set, and which component
revisions to store.

```
ObixButton naive model:  7 states
ObixButton minimized:    5 states  (disabled + loadingDisabled merged)

ObixInput naive model:   7 states  
ObixInput minimized:     5 states  (invalid + invalidFocused merged, valid + validTouched merged)
```

---

## Install

```bash
npm i @obinexusltd/obix-state-minimizer
```

---

## Quick Example

```typescript
import { minimizeFSM, buildAST, ASTOptimizer } from '@obinexusltd/obix-state-minimizer';
import type { FSM } from '@obinexusltd/obix-state-minimizer';

// Model ObixButton states as a formal FSM
type ButtonState = 'default' | 'focused' | 'loading' | 'disabled' | 'loadingDisabled';
type ButtonEvent = 'focus' | 'blur' | 'startLoading' | 'stopLoading' | 'disable' | 'enable' | 'click';

const buttonFSM: FSM<ButtonState, ButtonEvent> = {
  states:          new Set(['default', 'focused', 'loading', 'disabled', 'loadingDisabled']),
  alphabet:        new Set(['focus', 'blur', 'startLoading', 'stopLoading', 'disable', 'enable', 'click']),
  initialState:    'default',
  acceptingStates: new Set(['default', 'focused']),
  transition(state, event) { /* ... */ },
};

// Minimize: find behaviourally identical states
const result = minimizeFSM(buttonFSM);
console.log(result.originalStateCount);   // 5
console.log(result.minimizedStateCount);  // 4  (disabled + loadingDisabled merged)

// Both produce 'obix-button--disabled' — one CSS rule covers both
const disabledRep = result.stateMap.get('disabled');
const loadingDisabledRep = result.stateMap.get('loadingDisabled');
console.log(disabledRep === loadingDisabledRep); // true

// Visualize the minimized state machine
const ast = buildAST(buttonFSM, result);
console.log(ASTOptimizer.serialize(ast));
```

---

## Documentation

| Document | Description |
|---|---|
| [docs/01-theory.md](docs/01-theory.md) | FSM theory, Myhill-Nerode equivalence, minimization algorithm |
| [docs/02-html-element-states.md](docs/02-html-element-states.md) | Button, input, select, modal, tabs — before and after minimization |
| [docs/03-css-state-transitions.md](docs/03-css-state-transitions.md) | CSS class generation, ARIA mapping, reduced-motion support |
| [docs/04-api-reference.md](docs/04-api-reference.md) | Complete API: minimizeFSM, buildAST, USCNormalizer, BaseTokenizer, BaseParser |
| [docs/05-integration-guide.md](docs/05-integration-guide.md) | Step-by-step integration with @obinexusltd/obix-component-runtime |

---

## Examples

Runnable TypeScript examples in the `examples/` folder:

| Example | What it shows |
|---|---|
| [examples/01-component-lifecycle-fsm.ts](examples/01-component-lifecycle-fsm.ts) | OBIX lifecycle (CREATED→UPDATED→HALTED→DESTROYED) as minimized FSM |
| [examples/02-button-state-machine.ts](examples/02-button-state-machine.ts) | ObixButton states — discovers disabled + loadingDisabled are equivalent |
| [examples/03-form-validation-fsm.ts](examples/03-form-validation-fsm.ts) | ObixInput validation — merges invalid+invalidFocused, valid+validTouched |
| [examples/04-uscn-input-sanitizer.ts](examples/04-uscn-input-sanitizer.ts) | USCN normalizer for form input, file upload paths, search queries |
| [examples/05-component-state-tracker.ts](examples/05-component-state-tracker.ts) | Epsilon-free revision tracker (ObixTrackerA exhaustive / ObixTrackerB minimal) |
| [examples/06-html-output-tokenizer.ts](examples/06-html-output-tokenizer.ts) | BaseTokenizer subclass to parse and validate OBIX render(state) output |

```bash
npx tsx examples/01-component-lifecycle-fsm.ts
npx tsx examples/03-form-validation-fsm.ts
```

---

## Four Modules

### 1. FSM Minimizer (`src/minimizer/`)

Implements Myhill-Nerode partition refinement. The core of the library.

```typescript
import { minimizeFSM, partitionRefinement } from '@obinexusltd/obix-state-minimizer';

const result = minimizeFSM(fsm);
// result.stateMap   — original state -> representative
// result.removedStates — states that were merged
```

### 2. AST Optimizer (`src/minimizer/ASTOptimizer.ts`)

Three-phase optimization derived from `poc/node_html_parser` and `poc/node_js_parser`:

- **Phase 1** — BFS from `q0`, cycle-safe
- **Phase 2** — Node equivalence classes by signature
- **Phase 3** — Optimization metrics (node reduction ratio)

```typescript
import { buildAST, getASTMetrics, ASTOptimizer } from '@obinexusltd/obix-state-minimizer';

const ast = buildAST(fsm, result);
const metrics = getASTMetrics(fsm, result);
console.log(ASTOptimizer.serialize(ast));
```

### 3. USCN Normalizer (`src/normalizer/`)

Unicode-Only Structural Charset Normalizer — sanitizes form input before
passing to OBIX component actions.

Security invariant: `validate(normalize(s)) === validate(canonical(s))`

```typescript
import { normalizeInput, isPathSafe } from '@obinexusltd/obix-state-minimizer';

// Sanitize before btn.actions.change(state, value)
const { canonical } = normalizeInput(rawUserInput);

// Guard ObixFileUpload
if (!isPathSafe(uploadedPath)) throw new Error('Path traversal blocked');
```

### 4. BaseTokenizer + BaseParser (`src/tokenizer/`, `src/parser/`)

Generic state machine tokenizer and parser base classes. Extend them to build
language-specific processors for HTML, CSS, or JavaScript output from OBIX components.

```typescript
import { BaseTokenizer, BaseParser, createState } from '@obinexusltd/obix-state-minimizer';

// Tokenize OBIX render(state) output for post-render ARIA validation
class ObixHTMLTokenizer extends BaseTokenizer<MyToken> {
  protected nextToken(): void { /* ... */ }
}

// Parser with built-in state minimization
class ObixHTMLParser extends BaseParser<MyToken> {
  protected initializeStates(): void { /* define states + transitions */ }
  protected processToken(token, node, stack) { /* build AST */ }
}

// parse() automatically runs minimizeParserStates() before processing tokens
const { root, metrics } = new ObixHTMLParser().parse(tokens);
```

---

## How CSS Minimization Works

Before minimization, a naive ObixButton needs 7 CSS rules. After minimization, 5:

| State | Before | After |
|---|---|---|
| `default` | `.obix-button` | `.obix-button` |
| `focused` | `.obix-button:focus-visible` | `.obix-button:focus-visible` |
| `loading` | `.obix-button--loading` | `.obix-button--loading` |
| `disabled` | `.obix-button--disabled` | `.obix-button[aria-disabled="true"]` |
| `loadingDisabled` | `.obix-button--loading.obix-button--disabled` | **eliminated** (merged with disabled) |

The merged state means one ARIA attribute (`aria-disabled="true"`) covers both
cases — and one CSS rule styles them both. No redundant selectors.

See [docs/03-css-state-transitions.md](docs/03-css-state-transitions.md) for
the full CSS mapping for buttons, inputs, selects, modals, and navigation.

---

## Development

```bash
git clone https://github.com/obinexusmk2/obix-state-minimizer
cd obix-state-minimizer
npm install
npm run build   # tsc -> dist/
npm test        # 28 tests pass
```

---

## Theoretical Foundation

**State equivalence** — two states `p` and `q` are equivalent (`p ~ q`) iff:

```
for all w in Sigma*:  delta*(p, w) in F  <=>  delta*(q, w) in F
```

**Minimized automaton**: `A' = (Q', Sigma, delta', q0', F')` where `Q'` is
the partition of `Q` into equivalence classes under `~`.

**USCN security invariant**:

```
validate(normalize(s)) === validate(canonical(s))
```

Full theory: [docs/01-theory.md](docs/01-theory.md)

---

## License

MIT (c) 2024 Nnamdi Michael Okpala / OBINexus Computing — support@obinexus.org

> "We don't need more rules. We need better structure." — OBINexus Philosophy
