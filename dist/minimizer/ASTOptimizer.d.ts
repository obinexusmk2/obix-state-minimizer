import type { FSM, ASTNode, MinimizationResult } from '../types';
export interface NodeEquivalenceClass<S extends string, A extends string> {
    signature: string;
    nodes: Set<ASTNode<S, A>>;
}
export interface OptimizationMetrics {
    nodeReduction: {
        original: number;
        optimized: number;
        ratio: number;
    };
    stateClasses: {
        count: number;
        averageSize: number;
    };
    equivalenceClassCount: number;
}
export declare class ASTOptimizer<S extends string, A extends string> {
    private readonly fsm;
    private readonly result;
    private stateClasses;
    constructor(fsm: FSM<S, A>, result: MinimizationResult<S, A>);
    buildOptimizedAST(): ASTNode<string, A>;
    private buildStateClasses;
    private computeNodeSignature;
    private buildNode;
    computeMetrics(): OptimizationMetrics;
    static serialize<S extends string, A extends string>(node: ASTNode<S, A>, indent?: number, seen?: Set<S>): string;
}
export declare function buildAST<S extends string, A extends string>(fsm: FSM<S, A>, result: MinimizationResult<S, A>): ASTNode<string, A>;
export declare function getASTMetrics<S extends string, A extends string>(fsm: FSM<S, A>, result: MinimizationResult<S, A>): OptimizationMetrics;
//# sourceMappingURL=ASTOptimizer.d.ts.map