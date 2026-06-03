# State Minimization Theory

## What is a State Machine?

Every HTML element with interactive behaviour is a finite state machine (FSM).
A button, an input, a dropdown — each one moves through a defined set of states
in response to user events.

Formally, a state machine is a 5-tuple:

```
A = (Q, Sigma, delta, q0, F)
```

| Symbol | Meaning |
|---|---|
| `Q` | Finite set of states |
| `Sigma` | Finite set of input symbols (events) |
| `delta : Q x Sigma -> Q` | Transition function |
| `q0 in Q` | Initial state |
| `F subset Q` | Accepting (final) states |

## The Problem: Redundant States

When you model a UI component naively, you often end up with more states than
you need. States that behave identically — that respond the same way to every
possible future event — are redundant.

**Example: ObixButton**

```
default       -- user types  --> focused
focused       -- user leaves --> default
loading       -- user types  --> ??? (blocked)
disabled      -- user types  --> ??? (blocked)
loadingDisabled -- user types --> ??? (blocked)
```

`disabled` and `loadingDisabled` both block every user interaction.
They are behaviourally identical. You do not need two states — one is enough.

## State Equivalence (Myhill-Nerode)

Two states `p` and `q` are **equivalent** (`p ~ q`) if and only if for every
possible input sequence `w`, starting from `p` or `q` leads to the same
outcome:

```
p ~ q  iff  for all w in Sigma*:
  delta*(p, w) in F  <=>  delta*(q, w) in F
```

In plain terms: no sequence of events can distinguish `p` from `q`.

## Minimization Algorithm (Partition Refinement)

1. Start with two partitions: `{ accepting states }` and `{ non-accepting states }`
2. For each partition class, check whether all states in it transition to the
   same partition class on every symbol
3. If not, split the class
4. Repeat until no class can be split further
5. Each final class becomes one state in the minimized machine

This is the Myhill-Nerode / Hopcroft approach, implemented in
`src/minimizer/PartitionRefinement.ts`.

## Why This Matters for HTML/CSS Components

| Without minimization | With minimization |
|---|---|
| 7 button states, 7 CSS class handlers | 5 states (2 merged), 5 handlers |
| `invalid` and `invalidFocused` both set `aria-invalid=true` separately | Single state, single ARIA mapping |
| `disabled` and `loadingDisabled` duplicate event guard logic | One handler covers both |
| Full revision history stores no-op transitions | Epsilon-free tracker stores only real changes |

The minimizer does not change what the component *does*. It removes the states
that were doing the same thing twice.

## Abstract Syntax Tree Optimization

After minimization, the state machine's transition graph can be represented
as an Abstract Syntax Tree (AST). The AST optimizer:

1. **Phase 1** — Groups AST nodes by signature (state identity + accepting flag + children pattern)
2. **Phase 2** — Builds the tree via BFS from `q0`, tracking visited nodes to handle cycles
3. **Phase 3** — Computes metrics: node reduction ratio, equivalence class count

This mirrors the approach in `poc/node_html_parser/HTMLAstOptimizer.js` and
`poc/node_js_parser/JSAst.js`.

## References

- Okpala, N.M. (2024). *Automaton State Minimization and AST Optimization*. OBINexus Computing.
- Okpala, N.M. (2025). *State Machine Minimization — An Application-Based Case Study on Tennis*. OBINexus Computing.
- Okpala, N.M. (2025). *Isomorphic Reduction — Not a Bug, But a Feature*. OBINexus Computing.
- Myhill, J. (1957). Finite automata and their decision problems.
- Nerode, A. (1958). Linear automaton transformations.
