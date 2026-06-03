"use strict";
/**
 * Partition Refinement — Myhill-Nerode / Hopcroft-inspired algorithm.
 *
 * Two states p, q are equivalent (p ~ q) iff for every input sequence w ∈ Σ*,
 * δ*(p, w) ∈ F  ⟺  δ*(q, w) ∈ F
 *
 * This file implements the iterative partition-refinement that finds all
 * equivalence classes in O(n log n) time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.partitionRefinement = void 0;
/** Returns the partition of states as sets of equivalent state labels. */
function partitionRefinement(fsm) {
    const { states, alphabet, transition, acceptingStates } = fsm;
    const allStates = Array.from(states);
    // Initial partition: accepting vs non-accepting
    const accepting = new Set();
    const nonAccepting = new Set();
    for (const s of allStates) {
        if (acceptingStates.has(s)) {
            accepting.add(s);
        }
        else {
            nonAccepting.add(s);
        }
    }
    // Start with up to 2 classes (drop empty sets)
    let partition = [accepting, nonAccepting].filter((c) => c.size > 0);
    let changed = true;
    while (changed) {
        changed = false;
        const nextPartition = [];
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
exports.partitionRefinement = partitionRefinement;
/** Attempt to split a class based on transition signatures. */
function splitClass(cls, partition, alphabet, transition) {
    // Build a signature for each state: for each symbol, which class does
    // the target state belong to?
    const classIndex = buildClassIndex(partition);
    const buckets = new Map();
    for (const state of cls) {
        const sig = computeSignature(state, alphabet, transition, classIndex);
        let bucket = buckets.get(sig);
        if (!bucket) {
            bucket = new Set();
            buckets.set(sig, bucket);
        }
        bucket.add(state);
    }
    return Array.from(buckets.values());
}
/** Map each state to its class index. */
function buildClassIndex(partition) {
    const index = new Map();
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
function computeSignature(state, alphabet, transition, classIndex) {
    const parts = [];
    for (const symbol of alphabet) {
        const next = transition(state, symbol);
        const cls = next !== undefined ? (classIndex.get(next) ?? -1) : -1;
        parts.push(`${symbol}:${cls}`);
    }
    // Sort so order of alphabet iteration doesn't affect the signature
    return parts.sort().join('|');
}
//# sourceMappingURL=PartitionRefinement.js.map