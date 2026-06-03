/**
 * Partition Refinement — Myhill-Nerode / Hopcroft-inspired algorithm.
 *
 * Two states p, q are equivalent (p ~ q) iff for every input sequence w ∈ Σ*,
 * δ*(p, w) ∈ F  ⟺  δ*(q, w) ∈ F
 *
 * This file implements the iterative partition-refinement that finds all
 * equivalence classes in O(n log n) time.
 */
import type { FSM } from '../types';
/** Returns the partition of states as sets of equivalent state labels. */
export declare function partitionRefinement<S extends string, A extends string>(fsm: FSM<S, A>): Array<Set<S>>;
//# sourceMappingURL=PartitionRefinement.d.ts.map