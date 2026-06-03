"use strict";
/**
 * StateMinimizer — constructs the minimal FSM from partition refinement.
 *
 * Given A = (Q, Σ, δ, q₀, F), produces A' = (Q', Σ, δ', q'₀, F') where
 * Q' is the set of equivalence classes under Myhill-Nerode equivalence.
 *
 * Based on: Okpala, N.M. (2024). Automaton State Minimization and AST
 *           Optimization. OBINexus Computing Technical Report.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.minimizeFSM = exports.StateMinimizer = void 0;
const PartitionRefinement_1 = require("./PartitionRefinement");
class StateMinimizer {
    constructor(fsm) {
        this.fsm = fsm;
    }
    minimize() {
        const { fsm } = this;
        const partition = (0, PartitionRefinement_1.partitionRefinement)(fsm);
        // Build a canonical label for each equivalence class:
        // use the sorted, joined member names for determinism.
        const classLabel = (cls) => Array.from(cls).sort().join('+');
        // Map each original state → its equivalence class label
        const stateMap = new Map();
        for (const cls of partition) {
            const label = classLabel(cls);
            for (const s of cls) {
                stateMap.set(s, label);
            }
        }
        // Derive minimized state set
        const minStates = new Set(stateMap.values());
        // Derive accepting states
        const minAccepting = new Set();
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
        const minInitial = stateMap.get(fsm.initialState);
        // Derive transition function
        const minTransition = (state, symbol) => {
            // Pick a representative from the class
            const rep = findRepresentative(state, stateMap);
            if (rep === undefined)
                return undefined;
            const next = fsm.transition(rep, symbol);
            if (next === undefined)
                return undefined;
            return stateMap.get(next);
        };
        const minimized = {
            states: minStates,
            alphabet: fsm.alphabet,
            transition: minTransition,
            initialState: minInitial,
            acceptingStates: minAccepting,
        };
        // Which original states were removed (non-representatives)?
        const representatives = new Set();
        for (const cls of partition) {
            const arr = Array.from(cls).sort();
            representatives.add(arr[0]); // first alphabetically is representative
        }
        const removedStates = Array.from(fsm.states).filter((s) => !representatives.has(s));
        return {
            minimized,
            stateMap,
            originalStateCount: fsm.states.size,
            minimizedStateCount: minStates.size,
            removedStates,
        };
    }
}
exports.StateMinimizer = StateMinimizer;
/** Find one representative original state for a minimized state label. */
function findRepresentative(minLabel, stateMap) {
    for (const [orig, label] of stateMap) {
        if (label === minLabel)
            return orig;
    }
    return undefined;
}
/** Convenience factory */
function minimizeFSM(fsm) {
    return new StateMinimizer(fsm).minimize();
}
exports.minimizeFSM = minimizeFSM;
//# sourceMappingURL=StateMinimizer.js.map