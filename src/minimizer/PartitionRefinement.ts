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
export function partitionRefinement<S extends string, A extends string>(
  fsm: FSM<S, A>
): Array<Set<S>> {
  const { states, alphabet, transition, acceptingStates } = fsm;
  const allStates = Array.from(states);

  // Initial partition: accepting vs non-accepting
  const accepting = new Set<S>();
  const nonAccepting = new Set<S>();

  for (const s of allStates) {
    if (acceptingStates.has(s)) {
      accepting.add(s);
    } else {
      nonAccepting.add(s);
    }
  }

  // Start with up to 2 classes (drop empty sets)
  let partition: Array<Set<S>> = [accepting, nonAccepting].filter(
    (c) => c.size > 0
  );

  let changed = true;
  while (changed) {
    changed = false;
    const nextPartition: Array<Set<S>> = [];

    for (const cls of partition) {
      const splits = splitClass(cls, partition, alphabet, transition);
      if (splits.length > 1) {
        changed = true;
      }
      nextPartition.push(...splits);
    }

    partition = nextPartition;
  }

  return partition;
}

/** Attempt to split a class based on transition signatures. */
function splitClass<S extends string, A extends string>(
  cls: Set<S>,
  partition: Array<Set<S>>,
  alphabet: ReadonlySet<A>,
  transition: FSM<S, A>['transition']
): Array<Set<S>> {
  // Build a signature for each state: for each symbol, which class does
  // the target state belong to?
  const classIndex = buildClassIndex(partition);
  const buckets = new Map<string, Set<S>>();

  for (const state of cls) {
    const sig = computeSignature(state, alphabet, transition, classIndex);
    let bucket = buckets.get(sig);
    if (!bucket) {
      bucket = new Set<S>();
      buckets.set(sig, bucket);
    }
    bucket.add(state);
  }

  return Array.from(buckets.values());
}

/** Map each state to its class index. */
function buildClassIndex<S extends string>(
  partition: Array<Set<S>>
): Map<S, number> {
  const index = new Map<S, number>();
  for (let i = 0; i < partition.length; i++) {
    for (const s of partition[i]) {
      index.set(s, i);
    }
  }
  return index;
}

/**
 * A state's signature: a string encoding which equivalence class each
 * symbol leads to. States with identical signatures are equivalent under
 * the current partition.
 */
function computeSignature<S extends string, A extends string>(
  state: S,
  alphabet: ReadonlySet<A>,
  transition: FSM<S, A>['transition'],
  classIndex: Map<S, number>
): string {
  const parts: string[] = [];
  for (const symbol of alphabet) {
    const next = transition(state, symbol);
    const cls = next !== undefined ? (classIndex.get(next) ?? -1) : -1;
    parts.push(`${symbol}:${cls}`);
  }
  // Sort so order of alphabet iteration doesn't affect the signature
  return parts.sort().join('|');
}
