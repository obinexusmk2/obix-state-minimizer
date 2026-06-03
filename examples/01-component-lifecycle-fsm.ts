/**
 * Example 01: OBIX Component Lifecycle as a Minimized FSM
 *
 * OBIX components follow a four-state lifecycle:
 *   CREATED -> UPDATED -> HALTED -> DESTROYED
 *
 * This example models that lifecycle as a formal FSM, runs Myhill-Nerode
 * minimization on it, and builds the optimized AST.
 *
 * Integration: obix-component-runtime lifecycle + obix-state-minimizer
 */

import { minimizeFSM, buildAST, ASTOptimizer, getASTMetrics } from '../src';
import type { FSM } from '../src';

// ---------------------------------------------------------------------------
// OBIX lifecycle states and events (from OBIX docs: Component Lifecycle)
// ---------------------------------------------------------------------------

type LifecycleState = 'CREATED' | 'UPDATED' | 'HALTED' | 'DESTROYED';
type LifecycleEvent = 'dispatch' | 'halt' | 'resume' | 'destroy';

const lifecycleFSM: FSM<LifecycleState, LifecycleEvent> = {
  states: new Set<LifecycleState>(['CREATED', 'UPDATED', 'HALTED', 'DESTROYED']),
  alphabet: new Set<LifecycleEvent>(['dispatch', 'halt', 'resume', 'destroy']),
  initialState: 'CREATED',
  acceptingStates: new Set<LifecycleState>(['UPDATED', 'CREATED']), // "live" states

  transition(state, event) {
    const table: Record<LifecycleState, Partial<Record<LifecycleEvent, LifecycleState>>> = {
      CREATED:   { dispatch: 'UPDATED', halt: 'HALTED',    destroy: 'DESTROYED' },
      UPDATED:   { dispatch: 'UPDATED', halt: 'HALTED',    destroy: 'DESTROYED' },
      HALTED:    { resume:   'UPDATED',                    destroy: 'DESTROYED' },
      DESTROYED: {},
    };
    return table[state][event];
  },
};

// ---------------------------------------------------------------------------
// Minimize: find equivalent states
// ---------------------------------------------------------------------------

const result = minimizeFSM(lifecycleFSM);

console.log('=== OBIX Lifecycle FSM Minimization ===\n');
console.log(`Original states (${result.originalStateCount}): CREATED, UPDATED, HALTED, DESTROYED`);
console.log(`Minimized states (${result.minimizedStateCount})`);
console.log('\nState equivalence map:');
for (const [original, representative] of result.stateMap) {
  console.log(`  ${original} -> [${representative}]`);
}
if (result.removedStates.length > 0) {
  console.log(`\nMerged (redundant) states: ${result.removedStates.join(', ')}`);
}

// ---------------------------------------------------------------------------
// AST: visualize the minimized lifecycle
// ---------------------------------------------------------------------------

const ast = buildAST(lifecycleFSM, result);
console.log('\n=== Minimized Lifecycle AST ===\n');
console.log(ASTOptimizer.serialize(ast));

const metrics = getASTMetrics(lifecycleFSM, result);
console.log('=== Optimization Metrics ===');
console.log(`  Node reduction: ${metrics.nodeReduction.original} -> ${metrics.nodeReduction.optimized} (ratio: ${metrics.nodeReduction.ratio.toFixed(2)})`);
console.log(`  Equivalence classes found: ${metrics.equivalenceClassCount}`);

// ---------------------------------------------------------------------------
// Practical use: validate a component event sequence
// ---------------------------------------------------------------------------

function simulateLifecycle(events: LifecycleEvent[]): LifecycleState {
  const { minimized } = result;
  let current = minimized.initialState;
  for (const event of events) {
    const next = minimized.transition(current, event);
    if (next !== undefined) current = next;
  }
  return current;
}

console.log('\n=== Lifecycle Simulation ===');
console.log('dispatch, dispatch, halt, resume, destroy ->',
  simulateLifecycle(['dispatch', 'dispatch', 'halt', 'resume', 'destroy']));
console.log('dispatch, destroy ->',
  simulateLifecycle(['dispatch', 'destroy']));
