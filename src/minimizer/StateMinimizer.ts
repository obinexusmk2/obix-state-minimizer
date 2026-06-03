/**
 * StateMinimizer — constructs the minimal FSM from partition refinement.
 *
 * Given A = (Q, Σ, δ, q₀, F), produces A' = (Q', Σ, δ', q'₀, F') where
 * Q' is the set of equivalence classes under Myhill-Nerode equivalence.
 *
 * Based on: Okpala, N.M. (2024). Automaton State Minimization and AST
 *           Optimization. OBINexus Computing Technical Report.
 */

import type { FSM, MinimizationResult } from '../types';
import { partitionRefinement } from './PartitionRefinement';

export class StateMinimizer<S extends string, A extends string> {
  constructor(private readonly fsm: FSM<S, A>) {}

  minimize(): MinimizationResult<S, A> {
    const { fsm } = this;
    const partition = partitionRefinement(fsm);

    // Build a canonical label for each equivalence class:
    // use the sorted, joined member names for determinism.
    const classLabel = (cls: Set<S>): string =>
      Array.from(cls).sort().join('+');

    // Map each original state → its equivalence class label
    const stateMap = new Map<S, string>();
    for (const cls of partition) {
      const label = classLabel(cls);
      for (const s of cls) {
        stateMap.set(s, label);
      }
    }

    // Derive minimized state set
    const minStates = new Set<string>(stateMap.values());

    // Derive accepting states
    const minAccepting = new Set<string>();
    for (const cls of partition) {
      const label = classLabel(cls);
      for (const s of cls) {
        if (fsm.acceptingStates.has(s)) {
          minAccepting.add(label);
          break;
        }
      }
    }

    // Derive initial state
    const minInitial = stateMap.get(fsm.initialState)!;

    // Derive transition function
    const minTransition = (state: string, symbol: A): string | undefined => {
      // Pick a representative from the class
      const rep = findRepresentative(state, stateMap);
      if (rep === undefined) return undefined;
      const next = fsm.transition(rep, symbol);
      if (next === undefined) return undefined;
      return stateMap.get(next);
    };

    const minimized: FSM<string, A> = {
      states: minStates,
      alphabet: fsm.alphabet,
      transition: minTransition,
      initialState: minInitial,
      acceptingStates: minAccepting,
    };

    // Which original states were removed (non-representatives)?
    const representatives = new Set<S>();
    for (const cls of partition) {
      const arr = Array.from(cls).sort();
      representatives.add(arr[0] as S); // first alphabetically is representative
    }
    const removedStates = Array.from(fsm.states).filter(
      (s) => !representatives.has(s)
    );

    return {
      minimized,
      stateMap,
      originalStateCount: fsm.states.size,
      minimizedStateCount: minStates.size,
      removedStates,
    };
  }
}

/** Find one representative original state for a minimized state label. */
function findRepresentative<S extends string>(
  minLabel: string,
  stateMap: Map<S, string>
): S | undefined {
  for (const [orig, label] of stateMap) {
    if (label === minLabel) return orig;
  }
  return undefined;
}

/** Convenience factory */
export function minimizeFSM<S extends string, A extends string>(
  fsm: FSM<S, A>
): MinimizationResult<S, A> {
  return new StateMinimizer(fsm).minimize();
}
