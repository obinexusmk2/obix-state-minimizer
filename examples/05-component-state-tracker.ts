/**
 * Example 05: OBIX Component State Tracker
 *
 * Mirrors the TennisTracker pattern (Program A vs Program B) for OBIX components.
 *
 * Program A (ObixTrackerA): records every state transition including no-ops
 *   — useful for debugging, telemetry, full audit trails
 *
 * Program B (ObixTrackerB): records only meaningful transitions (epsilon-free)
 *   — useful for production, undo/redo history, efficient revision storage
 *
 * From OBIX docs (Data-Oriented Programming):
 *   btn.revisions // [initialState, state1, state2, ...]
 *   btn.undo()    // reverts to previous revision
 *
 * Integration: @obinexusltd/obix-component-runtime revision tracking
 *              + @obinexusltd/obix-state-minimizer TennisTracker pattern
 */

// ---------------------------------------------------------------------------
// Generic OBIX state transition types
// ---------------------------------------------------------------------------

export type ObixAction =
  | 'setLoading'
  | 'setDisabled'
  | 'click'
  | 'focus'
  | 'blur'
  | 'change'
  | 'reset'
  | 'NO_OP';  // epsilon — state didn't actually change

export interface ObixRevision<S = Record<string, unknown>> {
  action: ObixAction;
  state: S;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Program A: exhaustive tracker (records every action including NO_OP)
// Equivalent to OBIX btn.revisions with maxRevisions: Infinity
// ---------------------------------------------------------------------------

export class ObixTrackerA<S = Record<string, unknown>> {
  private revisions: ObixRevision<S>[] = [];
  private currentState: S;

  constructor(initialState: S) {
    this.currentState = initialState;
    this.revisions.push({
      action: 'reset',
      state: initialState,
      timestamp: Date.now(),
    });
  }

  record(action: ObixAction, nextState: S): S {
    // Records even if state is identical (no-op)
    this.revisions.push({ action, state: nextState, timestamp: Date.now() });
    this.currentState = nextState;
    return nextState;
  }

  undo(): S | null {
    if (this.revisions.length <= 1) return null;
    this.revisions.pop();
    this.currentState = this.revisions[this.revisions.length - 1].state;
    return this.currentState;
  }

  getRevisions() { return [...this.revisions]; }
  getState() { return this.currentState; }
  getRevisionCount() { return this.revisions.length; }
}

// ---------------------------------------------------------------------------
// Program B: minimal tracker (skips NO_OP transitions)
// Equivalent to minimized OBIX revision history
// ---------------------------------------------------------------------------

export class ObixTrackerB<S = Record<string, unknown>> {
  private revisions: ObixRevision<S>[] = [];
  private currentState: S;

  constructor(initialState: S) {
    this.currentState = initialState;
    this.revisions.push({
      action: 'reset',
      state: initialState,
      timestamp: Date.now(),
    });
  }

  record(action: ObixAction, nextState: S): S {
    if (action === 'NO_OP') {
      // Epsilon transition — skip recording, return current
      return this.currentState;
    }
    // Only record if state actually changed
    const prev = JSON.stringify(this.currentState);
    const next = JSON.stringify(nextState);
    if (prev !== next) {
      this.revisions.push({ action, state: nextState, timestamp: Date.now() });
      this.currentState = nextState;
    }
    return nextState;
  }

  undo(): S | null {
    if (this.revisions.length <= 1) return null;
    this.revisions.pop();
    this.currentState = this.revisions[this.revisions.length - 1].state;
    return this.currentState;
  }

  getRevisions() { return [...this.revisions]; }
  getState() { return this.currentState; }
  getRevisionCount() { return this.revisions.length; }
}

// ---------------------------------------------------------------------------
// Demo: simulate an OBIX button's state changes
// ---------------------------------------------------------------------------

type BtnState = { label: string; loading: boolean; disabled: boolean };

const initialBtnState: BtnState = { label: 'Save', loading: false, disabled: false };

const trackerA = new ObixTrackerA<BtnState>(initialBtnState);
const trackerB = new ObixTrackerB<BtnState>(initialBtnState);

// Simulate: user clicks -> loading -> no-op -> loading ends -> disabled
const events: Array<[ObixAction, BtnState]> = [
  ['click',       { label: 'Save', loading: false, disabled: false }], // click but state unchanged
  ['setLoading',  { label: 'Save', loading: true,  disabled: true  }],
  ['NO_OP',       { label: 'Save', loading: true,  disabled: true  }], // ping with no change
  ['NO_OP',       { label: 'Save', loading: true,  disabled: true  }],
  ['setLoading',  { label: 'Save', loading: false, disabled: false }],
  ['setDisabled', { label: 'Save', loading: false, disabled: true  }],
];

for (const [action, state] of events) {
  trackerA.record(action, state);
  trackerB.record(action, state);
}

console.log('=== OBIX Component State Tracker ===\n');
console.log('Simulated events:', events.map(([a]) => a).join(' -> '));
console.log();
console.log(`TrackerA (exhaustive) revisions: ${trackerA.getRevisionCount()}`);
console.log(`TrackerB (minimal)    revisions: ${trackerB.getRevisionCount()}`);
console.log();

console.log('TrackerA full history:');
for (const { action, state } of trackerA.getRevisions()) {
  console.log(`  [${action.padEnd(13)}] loading=${state.loading} disabled=${state.disabled}`);
}

console.log('\nTrackerB minimal history (NO_OPs removed, duplicates skipped):');
for (const { action, state } of trackerB.getRevisions()) {
  console.log(`  [${action.padEnd(13)}] loading=${state.loading} disabled=${state.disabled}`);
}

// Undo demo
console.log('\nTrackerB undo:');
const prev = trackerB.undo();
console.log(`  After undo: loading=${prev?.loading} disabled=${prev?.disabled}`);

// ---------------------------------------------------------------------------
// Integration note
// ---------------------------------------------------------------------------
console.log(`
=== Integration with @obinexusltd/obix-component-runtime ===

  import { createButton } from '@obinexusltd/obix-component-runtime';
  import { ObixTrackerB } from './05-component-state-tracker';

  const btn = createButton({ label: 'Save', variant: 'primary' });
  const tracker = new ObixTrackerB(btn.state);

  function dispatch(action, ...args) {
    const nextState = btn.actions[action](tracker.getState(), ...args);
    tracker.record(action, nextState);
    document.getElementById('app').innerHTML = btn.render(tracker.getState());
  }

  // ObixTrackerB gives you lean, undo-capable revision history —
  // same model as btn.revisions but with epsilon (no-op) filtering.
`);
