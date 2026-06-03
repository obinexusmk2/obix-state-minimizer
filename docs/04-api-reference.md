# API Reference

## FSM Minimizer

### `minimizeFSM(fsm)`

Runs Myhill-Nerode partition refinement on a formal FSM and returns the
minimal equivalent machine.

```typescript
import { minimizeFSM } from '@obinexusltd/obix-state-minimizer';
import type { FSM } from '@obinexusltd/obix-state-minimizer';

type S = 'default' | 'loading' | 'disabled';
type A = 'click' | 'startLoading' | 'disable';

const fsm: FSM<S, A> = {
  states:         new Set(['default', 'loading', 'disabled']),
  alphabet:       new Set(['click', 'startLoading', 'disable']),
  initialState:   'default',
  acceptingStates: new Set(['default']),
  transition(state, event) { ... },
};

const result = minimizeFSM(fsm);
```

**Returns `MinimizationResult<S, A>`:**

| Field | Type | Description |
|---|---|---|
| `minimized` | `FSM<string, A>` | The reduced FSM |
| `stateMap` | `Map<S, string>` | Maps each original state to its representative |
| `originalStateCount` | `number` | |
| `minimizedStateCount` | `number` | |
| `removedStates` | `S[]` | States that were merged into representatives |

---

### `partitionRefinement(fsm)`

Low-level: runs the partition refinement algorithm and returns the raw partition.

```typescript
import { partitionRefinement } from '@obinexusltd/obix-state-minimizer';

const partition = partitionRefinement(fsm);
// Returns: Array<Set<S>>
// Each Set is one equivalence class of behaviourally identical states.
```

---

## AST Optimizer

### `buildAST(fsm, result)`

Builds an optimized Abstract Syntax Tree from the minimized FSM.
Uses cycle-safe BFS from `q0` and populates node equivalence classes.

```typescript
import { buildAST } from '@obinexusltd/obix-state-minimizer';

const ast = buildAST(fsm, result);
// ast.state     — label of the initial minimized state
// ast.accepting — whether the initial state is accepting
// ast.children  — Map<symbol, ASTNode> for each outgoing transition
```

**`ASTNode<S, A>`:**

| Field | Type | Description |
|---|---|---|
| `state` | `S` | State label |
| `accepting` | `boolean` | Whether this is an accepting state |
| `children` | `Map<A, ASTNode<S, A>>` | Outgoing transitions |

---

### `ASTOptimizer.serialize(node)`

Returns a human-readable indented string of the AST (for debugging).

```typescript
import { ASTOptimizer } from '@obinexusltd/obix-state-minimizer';

console.log(ASTOptimizer.serialize(ast));
// [A]
//   --a-->
//     [B+C] [ACCEPT]
//       --a-->
//         <cycle>
```

---

### `getASTMetrics(fsm, result)`

Returns optimization metrics after building the AST.

```typescript
import { getASTMetrics } from '@obinexusltd/obix-state-minimizer';

const metrics = getASTMetrics(fsm, result);
```

**Returns `OptimizationMetrics`:**

| Field | Description |
|---|---|
| `nodeReduction.original` | State count before minimization |
| `nodeReduction.optimized` | State count after minimization |
| `nodeReduction.ratio` | `optimized / original` (lower is better) |
| `stateClasses.count` | Number of equivalence classes found |
| `stateClasses.averageSize` | Average nodes per class |
| `equivalenceClassCount` | Same as `stateClasses.count` |

---

## USCN Normalizer

### `normalizeInput(input)`

Normalizes a string to its canonical Unicode form. Decodes all percent-encoding
variants iteratively, applies NFC normalization, and collapses path separators.

```typescript
import { normalizeInput } from '@obinexusltd/obix-state-minimizer';

const { canonical, detectedEncoding, normalized } = normalizeInput('%2e%2e%2f');
// canonical:        '../'
// detectedEncoding: 'uri-encoded'
// normalized:       true
```

**Returns `USCNResult`:**

| Field | Type | Description |
|---|---|---|
| `canonical` | `string` | Fully decoded, NFC-normalized form |
| `detectedEncoding` | `EncodingType` | `'direct' \| 'uri-encoded' \| 'utf8-overlong' \| 'mixed' \| 'canonical'` |
| `normalized` | `boolean` | Whether any transformation was applied |

---

### `isPathSafe(input)`

Returns `true` if the path contains no traversal sequences after full normalization.

```typescript
import { isPathSafe } from '@obinexusltd/obix-state-minimizer';

isPathSafe('../etc/passwd');        // false
isPathSafe('%2e%2e%2fetc%2fpasswd'); // false (decoded first)
isPathSafe('assets/logo.png');      // true
```

**Security invariant:** `validate(normalize(s)) === validate(canonical(s))`

---

### `USCNormalizer` class

```typescript
import { USCNormalizer } from '@obinexusltd/obix-state-minimizer';

const uscn = new USCNormalizer();
uscn.normalize(input);       // -> USCNResult
uscn.validatePath(input);    // -> boolean
```

---

## BaseTokenizer

Abstract base class for character-level state machine tokenizers.
Extend it to build language-specific tokenizers (HTML, CSS, JS).

```typescript
import { BaseTokenizer } from '@obinexusltd/obix-state-minimizer';
import type { TokenBase } from '@obinexusltd/obix-state-minimizer';

interface MyToken extends TokenBase {
  type: 'Word' | 'EOF';
  value: string;
}

class MyTokenizer extends BaseTokenizer<MyToken> {
  protected nextToken(): void {
    const start = this.position;
    const value = this.readWhile(ch => /\w/.test(ch));
    if (value) {
      this.tokens.push({
        type: 'Word', value,
        start, end: this.position,
        line: this.line, column: this.column,
      });
    } else {
      this.advance(); // skip unknown character
    }
  }

  protected onEOF(): void {
    this.tokens.push({ type: 'EOF', value: '',
      start: this.position, end: this.position,
      line: this.line, column: this.column });
  }
}

const { tokens, errors } = new MyTokenizer('hello world').tokenize();
```

**Protected primitives:**

| Method | Description |
|---|---|
| `peek(offset?)` | Look at character at `position + offset` without consuming |
| `advance()` | Consume and return the current character, update line/column |
| `match(str)` | Return `true` if input starts with `str` at current position |
| `readWhile(predicate)` | Consume characters while predicate holds |
| `skipWhitespace()` | Advance past whitespace |
| `skipUntil(target)` | Advance until `target` string is found, then consume it |
| `addError(msg, start)` | Push a `TokenizerError` |

---

## BaseParser

Abstract base class for token-level parsers with built-in state minimization.

```typescript
import { BaseParser, createState, createNode } from '@obinexusltd/obix-state-minimizer';
import type { ParseNode, ParserState } from '@obinexusltd/obix-state-minimizer';

type Token = { type: 'OPEN' | 'CLOSE' | 'TEXT'; value: string };

class MyParser extends BaseParser<Token> {
  private initial!: ParserState;
  private inBlock!: ParserState;

  protected initializeStates(): void {
    this.initial  = createState('Initial',  false);
    this.inBlock  = createState('InBlock',  true);

    this.initial.transitions.set('OPEN', this.inBlock);
    this.inBlock.transitions.set('TEXT', this.inBlock);
    this.inBlock.transitions.set('CLOSE', this.initial);

    this.states.add(this.initial);
    this.states.add(this.inBlock);
    this.currentState = this.initial;
  }

  protected processToken(token: Token, current: ParseNode, stack: ParseNode[]): ParseNode {
    this.transition(token.type);
    const node = createNode(token.type, {
      value: token.value,
      metadata: {
        equivalenceClass: this.getEquivalenceClass(this.currentState),
        isMinimized: true,
      },
    });
    current.children.push(node);
    return current;
  }
}

const parser = new MyParser();
const { root, metrics } = parser.parse(tokens);
// metrics.originalStateCount   — states before minimization
// metrics.minimizedStateCount  — states after minimization
// metrics.optimizationRatio    — minimized / original
```

`minimizeParserStates()` is called automatically by `parse()`.
It converts the parser's own state graph into a formal FSM and runs
partition refinement before processing any tokens.

---

## Types

```typescript
// FSM 5-tuple
interface FSM<S extends string, A extends string> {
  states:         ReadonlySet<S>;
  alphabet:       ReadonlySet<A>;
  transition:     (state: S, symbol: A) => S | undefined;
  initialState:   S;
  acceptingStates: ReadonlySet<S>;
}

// Minimization result
interface MinimizationResult<S, A> {
  minimized:           FSM<string, A>;
  stateMap:            Map<S, string>;
  originalStateCount:  number;
  minimizedStateCount: number;
  removedStates:       S[];
}

// AST node
interface ASTNode<S, A> {
  state:    S;
  children: Map<A, ASTNode<S, A>>;
  accepting: boolean;
}
```
