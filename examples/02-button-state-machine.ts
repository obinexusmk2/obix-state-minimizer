/**
 * Example 02: OBIX Button State Machine Minimization
 *
 * ObixButton has these logical states:
 *   default | hover | loading | disabled | focused
 *
 * Events: click, focus, blur, startLoading, stopLoading, enable, disable
 *
 * The minimizer finds which states are behaviourally equivalent
 * (e.g. `disabled` during loading vs explicit disable — both reject `click`).
 *
 * Integration: @obinexusltd/obix-component-runtime createButton
 *              + @obinexusltd/obix-state-minimizer
 */

import { minimizeFSM, buildAST, ASTOptimizer } from '../src';
import type { FSM } from '../src';

// ---------------------------------------------------------------------------
// Model ObixButton states as a formal FSM
// (mirrors the DOP state shape from OBIX docs)
// ---------------------------------------------------------------------------

type ButtonState =
  | 'default'
  | 'focused'
  | 'loading'
  | 'disabled'
  | 'loadingDisabled'; // loading=true AND disabled=true (same UX as disabled)

type ButtonEvent =
  | 'click'
  | 'focus'
  | 'blur'
  | 'startLoading'
  | 'stopLoading'
  | 'disable'
  | 'enable';

const buttonFSM: FSM<ButtonState, ButtonEvent> = {
  states: new Set<ButtonState>([
    'default', 'focused', 'loading', 'disabled', 'loadingDisabled'
  ]),
  alphabet: new Set<ButtonEvent>([
    'click', 'focus', 'blur', 'startLoading', 'stopLoading', 'disable', 'enable'
  ]),
  initialState: 'default',
  // Accepting = states where the button is interactive (click is meaningful)
  acceptingStates: new Set<ButtonState>(['default', 'focused']),

  transition(state, event) {
    const t: Record<ButtonState, Partial<Record<ButtonEvent, ButtonState>>> = {
      default:         { focus: 'focused', startLoading: 'loading', disable: 'disabled', click: 'default' },
      focused:         { blur: 'default',  startLoading: 'loading', disable: 'disabled', click: 'focused' },
      loading:         { stopLoading: 'default', disable: 'loadingDisabled' },
      disabled:        { enable: 'default' },
      loadingDisabled: { stopLoading: 'disabled', enable: 'loading' },
    };
    return t[state][event];
  },
};

// ---------------------------------------------------------------------------
// Minimize
// ---------------------------------------------------------------------------

const result = minimizeFSM(buttonFSM);

console.log('=== ObixButton State Minimization ===\n');
console.log(`Original states (${result.originalStateCount}):`);
console.log('  default, focused, loading, disabled, loadingDisabled\n');
console.log(`Minimized states (${result.minimizedStateCount}):`);
console.log('\nState map (original -> equivalence class):');
for (const [s, rep] of result.stateMap) {
  const merged = result.removedStates.includes(s) ? ' [MERGED]' : '';
  console.log(`  ${s.padEnd(16)} -> [${rep}]${merged}`);
}

// Key insight: disabled and loadingDisabled are equivalent —
// both reject `click` and `focus`; the minimizer will merge them.
const disabledRep = result.stateMap.get('disabled');
const loadingDisabledRep = result.stateMap.get('loadingDisabled');
console.log('\n--- Key insight ---');
if (disabledRep === loadingDisabledRep) {
  console.log('disabled == loadingDisabled: MERGED (same behaviour — both reject user interaction)');
} else {
  console.log('disabled != loadingDisabled: kept separate');
}

// ---------------------------------------------------------------------------
// AST: show the minimized button state machine
// ---------------------------------------------------------------------------

const ast = buildAST(buttonFSM, result);
console.log('\n=== Minimized Button AST ===\n');
console.log(ASTOptimizer.serialize(ast));

// ---------------------------------------------------------------------------
// Practical: map minimized states back to OBIX component actions
// ---------------------------------------------------------------------------

// In a real OBIX integration:
//
//   import { createButton } from '@obinexusltd/obix-component-runtime';
//
//   const btn = createButton({ label: 'Save', variant: 'primary' });
//   let state = btn.state;
//
//   // The minimized FSM drives which actions to call:
//   function applyEvent(event: ButtonEvent) {
//     const minState = result.minimized.transition(currentMinState, event);
//     if (event === 'startLoading') state = btn.actions.setLoading(state, true);
//     if (event === 'stopLoading')  state = btn.actions.setLoading(state, false);
//     if (event === 'disable')      state = btn.actions.setDisabled(state, true);
//     if (event === 'enable')       state = btn.actions.setDisabled(state, false);
//     document.getElementById('app').innerHTML = btn.render(state);
//   }

console.log('Integration note:');
console.log('  Use the minimized FSM to drive which OBIX action to call.');
console.log('  Merged states share a single action handler — no duplicate code.\n');
