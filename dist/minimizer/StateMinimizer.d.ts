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
export declare class StateMinimizer<S extends string, A extends string> {
    private readonly fsm;
    constructor(fsm: FSM<S, A>);
    minimize(): MinimizationResult<S, A>;
}
/** Convenience factory */
export declare function minimizeFSM<S extends string, A extends string>(fsm: FSM<S, A>): MinimizationResult<S, A>;
//# sourceMappingURL=StateMinimizer.d.ts.map