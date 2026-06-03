/**
 * Example 03: OBIX Form Input Validation State Machine
 *
 * OBIX Input (ObixInput) validates on blur/change events.
 * The validation pipeline is:
 *   pristine -> touched -> validating -> valid | invalid
 *
 * This example minimizes the validation FSM and shows how the minimized
 * states map back to ARIA attributes on the rendered input.
 *
 * From OBIX docs (Lesson 4: Handling UI Errors):
 *   state contains: { value, error, valid, ariaInvalid, ariaDescribedBy }
 *   render produces: aria-invalid, aria-describedby on <input>
 *
 * Integration: @obinexusltd/obix-component-runtime createInput
 *              + @obinexusltd/obix-state-minimizer
 */

import { minimizeFSM, buildAST, ASTOptimizer } from '../src';
import type { FSM } from '../src';

// ---------------------------------------------------------------------------
// Validation FSM
// ---------------------------------------------------------------------------

type ValidationState =
  | 'pristine'       // untouched, no validation run
  | 'touched'        // user interacted but not yet validated
  | 'validating'     // async check in progress (aria-busy)
  | 'valid'          // passes validation (aria-invalid=false)
  | 'invalid'        // fails validation (aria-invalid=true)
  | 'validTouched'   // valid after having been invalid (same as valid for UX)
  | 'invalidFocused'; // invalid + field is focused (same ARIA as invalid)

type ValidationEvent =
  | 'change'    // user types
  | 'blur'      // user leaves field
  | 'focus'     // user enters field
  | 'validate'  // sync validation completes (pass)
  | 'invalidate' // sync validation completes (fail)
  | 'reset';    // form reset

const validationFSM: FSM<ValidationState, ValidationEvent> = {
  states: new Set<ValidationState>([
    'pristine', 'touched', 'validating',
    'valid', 'invalid', 'validTouched', 'invalidFocused'
  ]),
  alphabet: new Set<ValidationEvent>([
    'change', 'blur', 'focus', 'validate', 'invalidate', 'reset'
  ]),
  initialState: 'pristine',
  acceptingStates: new Set<ValidationState>(['valid', 'validTouched']),

  transition(state, event) {
    const t: Record<ValidationState, Partial<Record<ValidationEvent, ValidationState>>> = {
      pristine:       { change: 'touched', focus: 'touched', reset: 'pristine' },
      touched:        { blur: 'validating', change: 'touched', reset: 'pristine' },
      validating:     { validate: 'valid', invalidate: 'invalid' },
      valid:          { change: 'touched', reset: 'pristine' },
      validTouched:   { change: 'touched', reset: 'pristine' },
      invalid:        { focus: 'invalidFocused', change: 'touched', reset: 'pristine' },
      invalidFocused: { blur: 'validating', change: 'touched', reset: 'pristine' },
    };
    return t[state][event];
  },
};

// ---------------------------------------------------------------------------
// Minimize
// ---------------------------------------------------------------------------

const result = minimizeFSM(validationFSM);

console.log('=== ObixInput Validation FSM Minimization ===\n');
console.log(`Original states (${result.originalStateCount}): ${Array.from(validationFSM.states).join(', ')}`);
console.log(`Minimized states (${result.minimizedStateCount})\n`);

console.log('State map:');
for (const [s, rep] of result.stateMap) {
  const tag = result.removedStates.includes(s) ? ' <- MERGED' : '';
  console.log(`  ${s.padEnd(18)} -> [${rep}]${tag}`);
}

// invalidFocused and invalid should merge (same ARIA output)
const invalidRep = result.stateMap.get('invalid');
const invalidFocusedRep = result.stateMap.get('invalidFocused');
const validRep = result.stateMap.get('valid');
const validTouchedRep = result.stateMap.get('validTouched');

console.log('\n--- Key insights ---');
if (invalidRep === invalidFocusedRep) {
  console.log('invalid == invalidFocused: MERGED (both render aria-invalid=true)');
}
if (validRep === validTouchedRep) {
  console.log('valid == validTouched: MERGED (both render aria-invalid=false, accepting)');
}

// ---------------------------------------------------------------------------
// AST visualization
// ---------------------------------------------------------------------------

const ast = buildAST(validationFSM, result);
console.log('\n=== Minimized Validation AST ===\n');
console.log(ASTOptimizer.serialize(ast));

// ---------------------------------------------------------------------------
// ARIA attribute mapper (practical integration)
// ---------------------------------------------------------------------------

function getAriaAttributes(minState: string): Record<string, string> {
  const { minimized } = result;
  const isAccepting = minimized.acceptingStates.has(minState);
  const isInitial = minState === minimized.initialState;

  // The minimized state's representative tells us which ARIA to apply
  const original = Array.from(result.stateMap.entries())
    .find(([, rep]) => rep === minState)?.[0];

  if (original === 'pristine' || original === 'touched') {
    return { 'aria-invalid': 'false', 'aria-busy': 'false' };
  }
  if (original === 'validating') {
    return { 'aria-invalid': 'false', 'aria-busy': 'true' };
  }
  if (isAccepting) {
    return { 'aria-invalid': 'false', 'aria-busy': 'false' };
  }
  return { 'aria-invalid': 'true', 'aria-busy': 'false' };
}

console.log('=== ARIA Attribute Mapping ===\n');
console.log('(In real usage, call createInput from @obinexusltd/obix-component-runtime)');
console.log('(The minimized FSM drives which ARIA state to render)\n');

for (const minState of result.minimized.states) {
  const attrs = getAriaAttributes(minState);
  console.log(`  [${minState}] -> aria-invalid="${attrs['aria-invalid']}" aria-busy="${attrs['aria-busy']}"`);
}

// ---------------------------------------------------------------------------
// Real OBIX integration sketch
// ---------------------------------------------------------------------------
console.log(`
=== Integration with @obinexusltd/obix-component-runtime ===

  import { createInput } from '@obinexusltd/obix-component-runtime';
  import { minimizeFSM } from '@obinexusltd/obix-state-minimizer';

  const input = createInput({
    name: 'email',
    type: 'email',
    label: 'Email Address',
    validation: 'blur',
    ariaDescribedBy: 'email-error'
  });

  // Drive OBIX actions from the minimized validation FSM
  let obixState = input.state;
  let minState = result.minimized.initialState;

  function handleChange(value: string) {
    minState = result.minimized.transition(minState, 'change') ?? minState;
    obixState = input.actions.change(obixState, value);
    document.getElementById('app').innerHTML = input.render(obixState);
  }

  function handleBlur() {
    minState = result.minimized.transition(minState, 'blur') ?? minState;
    obixState = input.actions.blur(obixState);
    // Trigger validation
    const valid = /^[\\w.-]+@[\\w.-]+\\.\\w+$/.test(obixState.value);
    const event = valid ? 'validate' : 'invalidate';
    minState = result.minimized.transition(minState, event) ?? minState;
    document.getElementById('app').innerHTML = input.render(obixState);
  }
`);
