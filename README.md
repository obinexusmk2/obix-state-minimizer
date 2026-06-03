# @obinexusltd/obix-state-minimizer

> Automaton state minimization, AST optimization, and Unicode structural normalization (USCN) for the [OBIX](https://github.com/obinexusmk2/obix) ecosystem.

**Author:** Nnamdi Michael Okpala  
**Org:** OBINexus Computing — [@obinexusmk2](https://github.com/obinexusmk2)  
**Support:** support@obinexus.org  
**License:** MIT

---

## Overview

This library implements the formal automaton minimization theory described in:

- *Automaton State Minimization and AST Optimization* — Okpala, N.M. (2024)
- *State Machine Minimization: An Application-Based Case Study on Tennis* — Okpala, N.M. (2025)
- *Isomorphic Reduction — Not a Bug, But a Feature* — Okpala, N.M. (2025)

Given a finite state machine `A = (Q, Σ, δ, q₀, F)`, the library:

1. **Minimizes** it to the smallest equivalent FSM using Myhill-Nerode partition refinement
2. **Optimizes** the corresponding Abstract Syntax Tree by removing redundant nodes
3. **Normalizes** Unicode input via the USCN framework (isomorphic reduction)

---

## Install

```bash
npm i @obinexusltd/obix-state-minimizer
```

Or clone the repo:

```bash
git clone https://github.com/obinexusmk2/obix-state-minimizer
cd obix-state-minimizer
npm install
npm run build
```

---

## Quick Start

### FSM Minimization

```ts
import { minimizeFSM } from '@obinexusltd/obix-state-minimizer';
import type { FSM } from '@obinexusltd/obix-state-minimizer';

// Define A = (Q, Σ, δ, q₀, F)
const fsm: FSM<'A' | 'B' | 'C', 'a' | 'b'> = {
  states: new Set(['A', 'B', 'C']),
  alphabet: new Set(['a', 'b']),
  initialState: 'A',
  acceptingStates: new Set(['B', 'C']),      // B and C are equivalent
  transition(state, symbol) {
    const t = {
      A: { a: 'B', b: 'C' },
      B: { a: 'B', b: 'B' },
      C: { a: 'C', b: 'C' },
    } as const;
    return t[state][symbol];
  },
};

const result = minimizeFSM(fsm);
console.log(result.originalStateCount);   // 3
console.log(result.minimizedStateCount);  // 2  — B and C merged
console.log(result.removedStates);        // ['C'] (or ['B'])
```

### AST Optimization

```ts
import { minimizeFSM, buildAST, ASTOptimizer } from '@obinexusltd/obix-state-minimizer';

const result = minimizeFSM(fsm);
const ast = buildAST(fsm, result);
console.log(ASTOptimizer.serialize(ast));
```

### Unicode Normalization (USCN)

```ts
import { normalizeInput, isPathSafe } from '@obinexusltd/obix-state-minimizer';

// Collapse encoding variants to canonical form
const { canonical } = normalizeInput('%2e%2e%2fetc%2fpasswd');
console.log(canonical);  // ../etc/passwd

// Security guard — validate after normalization
console.log(isPathSafe('%2e%2e%2f'));           // false (path traversal)
console.log(isPathSafe('assets/logo.png'));     // true
```

### Tennis Tracker (Reference Implementation)

```ts
import {
  TennisTrackerA,
  TennisTrackerB,
  minimizeTennisFSM,
} from '@obinexusltd/obix-state-minimizer';

// Program A — exhaustive (records every event including no-scores)
const trackerA = new TennisTrackerA();
trackerA.recordEvent('POINT');     // '15'
trackerA.recordEvent('NO_SCORE'); // 'LOVE' recorded again (redundant)

// Program B — minimal (skips epsilon / no-score transitions)
const trackerB = new TennisTrackerB();
trackerB.recordEvent('POINT');     // '15'
trackerB.recordEvent('NO_SCORE'); // state unchanged, nothing recorded

// FSM minimization of the tennis automaton
const result = minimizeTennisFSM();
console.log(result.originalStateCount);   // 5
console.log(result.minimizedStateCount);  // ≤ 5 (equivalent states merged)
```

---

## API Reference

### `minimizeFSM(fsm)`

Runs Myhill-Nerode partition refinement and returns a `MinimizationResult`:

| Field | Type | Description |
|---|---|---|
| `minimized` | `FSM<string, A>` | The reduced FSM |
| `stateMap` | `Map<S, string>` | Original state → representative |
| `originalStateCount` | `number` | |
| `minimizedStateCount` | `number` | |
| `removedStates` | `S[]` | States merged into representatives |

### `buildAST(fsm, result)`

Builds an `ASTNode` tree from the minimized FSM. Cycles are tracked to avoid infinite traversal.

### `ASTOptimizer.serialize(node)`

Returns a human-readable indented string of the AST.

### `normalizeInput(input)`

Returns `USCNResult`:

| Field | Type | Description |
|---|---|---|
| `canonical` | `string` | Fully decoded, NFC-normalized form |
| `detectedEncoding` | `EncodingType` | `'direct' \| 'uri-encoded' \| 'utf8-overlong' \| 'mixed' \| 'canonical'` |
| `normalized` | `boolean` | Whether any transformation was applied |

### `isPathSafe(input)`

Returns `true` if the path is free of traversal sequences after full normalization.

---

## Project Structure

```
obix-state-minimizer/
├── src/
│   ├── types.ts                        # FSM 5-tuple, ASTNode, result types
│   ├── index.ts                        # Public API exports
│   ├── minimizer/
│   │   ├── PartitionRefinement.ts      # Myhill-Nerode partition algorithm
│   │   ├── StateMinimizer.ts           # Minimized FSM construction
│   │   └── ASTOptimizer.ts             # AST build & serialization
│   ├── normalizer/
│   │   └── USCNormalizer.ts            # USCN — isomorphic reduction
│   └── tracker/
│       └── TennisTracker.ts            # Program A/B reference + tennis FSM
├── tests/
│   ├── minimizer.test.ts
│   ├── normalizer.test.ts
│   └── tracker.test.ts
├── package.json
├── tsconfig.json
├── jest.config.js
├── LICENSE
└── README.md
```

---

## Development

```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Coverage report
npm run test:coverage
```

---

## Theoretical Background

The minimization algorithm is grounded in automata theory:

**State Equivalence** — two states `p, q` are equivalent (`p ~ q`) iff:
```
∀w ∈ Σ*,  δ*(p, w) ∈ F  ⟺  δ*(q, w) ∈ F
```

**Minimization** produces `A' = (Q', Σ, δ', q'₀, F')` where `Q'` is the set of
equivalence classes under `~`.

**USCN Security Invariant:**
```
validate(normalize(s)) ≡ validate(canonical(s))
```

---

## Related OBIX Repositories

| Repo | Description |
|---|---|
| [`obinexusmk2/obix`](https://github.com/obinexusmk2/obix) | OBIX UI/UX runtime |
| [`obinexusmk2/obix-state-minimizer`](https://github.com/obinexusmk2/obix-state-minimizer) | This package |

---

## License

MIT © 2024 Nnamdi Michael Okpala / OBINexus Computing  
support@obinexus.org
