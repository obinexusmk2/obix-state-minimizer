import { minimizeFSM } from '../src/minimizer/StateMinimizer';
import { partitionRefinement } from '../src/minimizer/PartitionRefinement';
import { buildAST, ASTOptimizer } from '../src/minimizer/ASTOptimizer';
import type { FSM } from '../src/types';

type S3 = 'A' | 'B' | 'C';
type A2 = 'a' | 'b';

const fsm3: FSM<S3, A2> = {
  states: new Set<S3>(['A', 'B', 'C']),
  alphabet: new Set<A2>(['a', 'b']),
  initialState: 'A',
  acceptingStates: new Set<S3>(['B', 'C']),
  transition(state, symbol) {
    const t: Record<S3, Record<A2, S3>> = {
      A: { a: 'B', b: 'C' },
      B: { a: 'B', b: 'B' },
      C: { a: 'C', b: 'C' },
    };
    return t[state][symbol];
  },
};

describe('partitionRefinement', () => {
  it('merges equivalent accepting states B and C', () => {
    const partition = partitionRefinement(fsm3);
    expect(partition).toHaveLength(2);
    const sizes = partition.map((c: Set<S3>) => c.size).sort();
    expect(sizes).toEqual([1, 2]);
  });
});

describe('minimizeFSM', () => {
  it('reduces state count from 3 to 2', () => {
    const result = minimizeFSM(fsm3);
    expect(result.originalStateCount).toBe(3);
    expect(result.minimizedStateCount).toBe(2);
  });

  it('maps B and C to the same minimized state', () => {
    const result = minimizeFSM(fsm3);
    expect(result.stateMap.get('B')).toBe(result.stateMap.get('C'));
  });

  it('minimized FSM initial state is not accepting', () => {
    const result = minimizeFSM(fsm3);
    expect(result.minimized.acceptingStates.has(result.minimized.initialState)).toBe(false);
  });

  it('transitions from initial state lead to accepting state', () => {
    const result = minimizeFSM(fsm3);
    const { minimized } = result;
    const next = minimized.transition(minimized.initialState, 'a');
    expect(next).toBeDefined();
    expect(minimized.acceptingStates.has(next!)).toBe(true);
  });

  it('removed states array is non-empty', () => {
    const result = minimizeFSM(fsm3);
    expect(result.removedStates.length).toBeGreaterThan(0);
  });
});

type S2 = 'q0' | 'q1';
const fsmMinimal: FSM<S2, 'x'> = {
  states: new Set<S2>(['q0', 'q1']),
  alphabet: new Set(['x'] as const),
  initialState: 'q0',
  acceptingStates: new Set<S2>(['q1']),
  transition(state) { return state === 'q0' ? 'q1' : 'q1'; },
};

describe('minimizeFSM on already-minimal FSM', () => {
  it('does not increase state count', () => {
    const result = minimizeFSM(fsmMinimal);
    expect(result.minimizedStateCount).toBeLessThanOrEqual(result.originalStateCount);
  });
});

describe('ASTOptimizer', () => {
  it('builds AST rooted at initial minimized state', () => {
    const result = minimizeFSM(fsm3);
    const ast = buildAST(fsm3, result);
    expect(ast).toBeDefined();
    expect(ast.state).toBe(result.minimized.initialState);
  });

  it('serialize produces non-empty string', () => {
    const result = minimizeFSM(fsm3);
    const ast = buildAST(fsm3, result);
    const str = ASTOptimizer.serialize(ast);
    expect(typeof str).toBe('string');
    expect(str.length).toBeGreaterThan(0);
  });
});
