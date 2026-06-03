import { partitionRefinement } from '../minimizer/PartitionRefinement';
import type { FSM } from '../types';

export interface ParserState {
  readonly type: string;
  readonly isAccepting: boolean;
  transitions: Map<string, ParserState>;
}

export function createState(type: string, isAccepting: boolean): ParserState {
  return { type, isAccepting, transitions: new Map() };
}

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

export function createNode(type: string, partial?: Partial<ParseNode>): ParseNode {
  return { type, children: [], metadata: { equivalenceClass: -1, isMinimized: false }, ...partial };
}

export interface MinimizationMetrics {
  originalStateCount: number;
  minimizedStateCount: number;
  optimizationRatio: number;
}

export abstract class BaseParser<TToken> {
  protected states = new Set<ParserState>();
  protected currentState!: ParserState;
  protected equivalenceClasses = new Map<number, Set<ParserState>>();

  constructor() {
    this.initializeStates();
  }

  protected abstract initializeStates(): void;
  protected abstract processToken(token: TToken, currentNode: ParseNode, stack: ParseNode[]): ParseNode;

  minimizeParserStates(): MinimizationMetrics {
    const originalCount = this.states.size;
    const stateLabels = new Map<ParserState, string>();
    let i = 0;
    for (const s of this.states) stateLabels.set(s, `s${i++}`);

    const alphabet = new Set<string>();
    for (const s of this.states) for (const sym of s.transitions.keys()) alphabet.add(sym);

    const acceptingLabels = new Set<string>();
    for (const s of this.states) if (s.isAccepting) acceptingLabels.add(stateLabels.get(s)!);

    const fsm: FSM<string, string> = {
      states: new Set(stateLabels.values()),
      alphabet,
      initialState: stateLabels.get(this.currentState)!,
      acceptingStates: acceptingLabels,
      transition(state, symbol) {
        for (const [ps, label] of stateLabels) {
          if (label === state) {
            const target = ps.transitions.get(symbol);
            return target ? stateLabels.get(target) : undefined;
          }
        }
        return undefined;
      },
    };

    const partition = partitionRefinement(fsm);
    this.equivalenceClasses.clear();
    partition.forEach((cls, idx) => {
      const parserStates = new Set<ParserState>();
      for (const label of cls) {
        for (const [ps, l] of stateLabels) {
          if (l === label) parserStates.add(ps);
        }
      }
      this.equivalenceClasses.set(idx, parserStates);
    });

    return {
      originalStateCount: originalCount,
      minimizedStateCount: partition.length,
      optimizationRatio: partition.length / originalCount,
    };
  }

  protected getEquivalenceClass(state: ParserState): number {
    for (const [classId, states] of this.equivalenceClasses) {
      if (states.has(state)) return classId;
    }
    return -1;
  }

  protected transition(symbol: string): void {
    const next = this.currentState.transitions.get(symbol);
    if (next) this.currentState = next;
  }

  parse(tokens: TToken[]): { root: ParseNode; metrics: MinimizationMetrics } {
    const metrics = this.minimizeParserStates();
    const root = createNode('Root', { name: 'root' });
    const stack: ParseNode[] = [root];
    let current = root;
    for (const token of tokens) current = this.processToken(token, current, stack);
    return { root, metrics };
  }
}
