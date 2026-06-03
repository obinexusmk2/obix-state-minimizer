import type { FSM, ASTNode, MinimizationResult } from '../types';

export interface NodeEquivalenceClass<S extends string, A extends string> {
  signature: string;
  nodes: Set<ASTNode<S, A>>;
}

export interface OptimizationMetrics {
  nodeReduction: { original: number; optimized: number; ratio: number };
  stateClasses: { count: number; averageSize: number };
  equivalenceClassCount: number;
}

export class ASTOptimizer<S extends string, A extends string> {
  private stateClasses = new Map<number, NodeEquivalenceClass<S, A>>();

  constructor(
    private readonly fsm: FSM<S, A>,
    private readonly result: MinimizationResult<S, A>
  ) {}

  buildOptimizedAST(): ASTNode<string, A> {
    const { minimized } = this.result;
    const visited = new Map<string, ASTNode<string, A>>();
    const raw = this.buildNode(minimized.initialState, minimized, visited);
    // Pass the visited map so buildStateClasses won't recurse into cycles
    this.buildStateClasses(visited);
    return raw;
  }

  // Build equivalence classes from the flat set of visited nodes (cycle-safe)
  private buildStateClasses(visited: Map<string, ASTNode<string, A>>): void {
    const sigMap = new Map<string, Set<ASTNode<string, A>>>();
    for (const node of visited.values()) {
      const sig = this.computeNodeSignature(node);
      if (!sigMap.has(sig)) sigMap.set(sig, new Set());
      sigMap.get(sig)!.add(node);
    }
    let id = 0;
    for (const [sig, nodes] of sigMap) {
      if (nodes.size > 1) {
        this.stateClasses.set(id++, {
          signature: sig,
          nodes: nodes as unknown as Set<ASTNode<S, A>>,
        });
      }
    }
  }

  private computeNodeSignature(node: ASTNode<string, A>): string {
    const childStates = Array.from(node.children.values()).map((c) => c.state).join(',');
    return `${node.state}|accepting:${node.accepting}|children:[${childStates}]`;
  }

  private buildNode(
    state: string,
    fsm: FSM<string, A>,
    visited: Map<string, ASTNode<string, A>>
  ): ASTNode<string, A> {
    if (visited.has(state)) return visited.get(state)!;
    const node: ASTNode<string, A> = {
      state,
      children: new Map(),
      accepting: fsm.acceptingStates.has(state),
    };
    visited.set(state, node);
    for (const symbol of fsm.alphabet) {
      const next = fsm.transition(state, symbol);
      if (next !== undefined) node.children.set(symbol, this.buildNode(next, fsm, visited));
    }
    return node;
  }

  computeMetrics(): OptimizationMetrics {
    const classCount = this.stateClasses.size;
    const avgSize = classCount > 0
      ? Array.from(this.stateClasses.values()).reduce((acc, c) => acc + c.nodes.size, 0) / classCount
      : 0;
    return {
      nodeReduction: {
        original: this.result.originalStateCount,
        optimized: this.result.minimizedStateCount,
        ratio: this.result.minimizedStateCount / this.result.originalStateCount,
      },
      stateClasses: { count: classCount, averageSize: avgSize },
      equivalenceClassCount: classCount,
    };
  }

  static serialize<S extends string, A extends string>(
    node: ASTNode<S, A>,
    indent = 0,
    seen = new Set<S>()
  ): string {
    const prefix = '  '.repeat(indent);
    const marker = node.accepting ? ' [ACCEPT]' : '';
    let out = `${prefix}[${node.state}]${marker}\n`;
    if (seen.has(node.state)) return out + `${prefix}  <cycle>\n`;
    seen.add(node.state);
    for (const [sym, child] of node.children) {
      out += `${prefix}  --${sym}-->\n`;
      out += ASTOptimizer.serialize(child, indent + 2, new Set(seen));
    }
    return out;
  }
}

export function buildAST<S extends string, A extends string>(
  fsm: FSM<S, A>,
  result: MinimizationResult<S, A>
): ASTNode<string, A> {
  return new ASTOptimizer(fsm, result).buildOptimizedAST();
}

export function getASTMetrics<S extends string, A extends string>(
  fsm: FSM<S, A>,
  result: MinimizationResult<S, A>
): OptimizationMetrics {
  const optimizer = new ASTOptimizer(fsm, result);
  optimizer.buildOptimizedAST();
  return optimizer.computeMetrics();
}
