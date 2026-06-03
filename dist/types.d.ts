/**
 * @obinexusltd/obix-state-minimizer — Core Types
 *
 * Formal model: A = (Q, Σ, δ, q₀, F)
 * Based on: Okpala, N.M. (2024). Automaton State Minimization and AST Optimization.
 *           OBINexus Computing Technical Report.
 */
/** A finite state machine represented as a 5-tuple A = (Q, Σ, δ, q₀, F). */
export interface FSM<S extends string = string, A extends string = string> {
    /** Q — finite set of states */
    states: ReadonlySet<S>;
    /** Σ — finite input alphabet */
    alphabet: ReadonlySet<A>;
    /** δ : Q × Σ → Q — transition function */
    transition: TransitionFn<S, A>;
    /** q₀ ∈ Q — initial state */
    initialState: S;
    /** F ⊆ Q — set of accepting (final) states */
    acceptingStates: ReadonlySet<S>;
}
/** δ(state, symbol) → nextState | undefined (undefined = no transition / dead state) */
export type TransitionFn<S extends string, A extends string> = (state: S, symbol: A) => S | undefined;
/** Serialisable transition table — maps "state:symbol" → nextState */
export type TransitionTable<S extends string, A extends string> = Map<`${S}:${A}`, S>;
/** A node in the Abstract Syntax Tree of an automaton's transitions. */
export interface ASTNode<S extends string = string, A extends string = string> {
    /** State this node represents */
    state: S;
    /** Transitions out of this state: symbol → child node */
    children: Map<A, ASTNode<S, A>>;
    /** Whether this is an accepting state */
    accepting: boolean;
}
export interface MinimizationResult<S extends string, A extends string> {
    /** The minimized FSM */
    minimized: FSM<string, A>;
    /** Map from original state → representative state in minimized FSM */
    stateMap: Map<S, string>;
    /** Number of states before minimization */
    originalStateCount: number;
    /** Number of states after minimization */
    minimizedStateCount: number;
    /** States that were merged (removed) during minimization */
    removedStates: S[];
}
export interface USCNResult {
    /** Canonical (normalized) form of the input */
    canonical: string;
    /** Original encoding detected */
    detectedEncoding: EncodingType;
    /** Whether any normalization was applied */
    normalized: boolean;
}
export type EncodingType = 'direct' | 'uri-encoded' | 'utf8-overlong' | 'mixed' | 'canonical';
//# sourceMappingURL=types.d.ts.map