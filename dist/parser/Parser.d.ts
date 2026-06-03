export interface ParserState {
    readonly type: string;
    readonly isAccepting: boolean;
    transitions: Map<string, ParserState>;
}
export declare function createState(type: string, isAccepting: boolean): ParserState;
export interface ParseNode {
    type: string;
    name?: string;
    value?: string;
    attributes?: Map<string, string>;
    children: ParseNode[];
    metadata: {
        equivalenceClass: number;
        isMinimized: boolean;
        stateSignature?: string;
    };
}
export declare function createNode(type: string, partial?: Partial<ParseNode>): ParseNode;
export interface MinimizationMetrics {
    originalStateCount: number;
    minimizedStateCount: number;
    optimizationRatio: number;
}
export declare abstract class BaseParser<TToken> {
    protected states: Set<ParserState>;
    protected currentState: ParserState;
    protected equivalenceClasses: Map<number, Set<ParserState>>;
    constructor();
    protected abstract initializeStates(): void;
    protected abstract processToken(token: TToken, currentNode: ParseNode, stack: ParseNode[]): ParseNode;
    minimizeParserStates(): MinimizationMetrics;
    protected getEquivalenceClass(state: ParserState): number;
    protected transition(symbol: string): void;
    parse(tokens: TToken[]): {
        root: ParseNode;
        metrics: MinimizationMetrics;
    };
}
//# sourceMappingURL=Parser.d.ts.map