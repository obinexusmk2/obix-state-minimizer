import {
  TennisTrackerA,
  TennisTrackerB,
  buildTennisFSM,
  minimizeTennisFSM,
} from '../src/tracker/TennisTracker';

describe('TennisTrackerA (exhaustive)', () => {
  it('advances through all score states on POINT events', () => {
    const tracker = new TennisTrackerA();
    expect(tracker.recordEvent('POINT')).toBe('15');
    expect(tracker.recordEvent('POINT')).toBe('30');
    expect(tracker.recordEvent('POINT')).toBe('40');
    expect(tracker.recordEvent('POINT')).toBe('GAME');
  });

  it('records NO_SCORE as repeated current state', () => {
    const tracker = new TennisTrackerA();
    tracker.recordEvent('NO_SCORE');
    const record = tracker.getRecord('Player A');
    // Should have LOVE twice (initial + no-score)
    expect(record.scores).toHaveLength(2);
    expect(record.scores[1]).toBe('LOVE');
  });

  it('builds a larger record than TrackerB for the same events', () => {
    const eventsA = new TennisTrackerA();
    const eventsB = new TennisTrackerB();
    const sequence = ['POINT', 'NO_SCORE', 'POINT', 'NO_SCORE', 'POINT', 'POINT'] as const;
    sequence.forEach((e) => eventsA.recordEvent(e));
    sequence.forEach((e) => eventsB.recordEvent(e));
    // A records every event including no-scores; B skips them
    expect(eventsA.getRecord('A').scores.length).toBeGreaterThan(
      eventsB.getRecord('B').scores.length
    );
  });
});

describe('TennisTrackerB (minimal)', () => {
  it('advances through all score states on POINT events', () => {
    const tracker = new TennisTrackerB();
    expect(tracker.recordEvent('POINT')).toBe('15');
    expect(tracker.recordEvent('POINT')).toBe('30');
    expect(tracker.recordEvent('POINT')).toBe('40');
    expect(tracker.recordEvent('POINT')).toBe('GAME');
  });

  it('does NOT duplicate state on NO_SCORE event', () => {
    const tracker = new TennisTrackerB();
    tracker.recordEvent('NO_SCORE');
    const record = tracker.getRecord('Player B');
    // Should still only have the initial LOVE state
    expect(record.scores).toHaveLength(1);
    expect(record.scores[0]).toBe('LOVE');
  });

  it('ignores multiple NO_SCORE events without growing the score list', () => {
    const tracker = new TennisTrackerB();
    tracker.recordEvent('NO_SCORE');
    tracker.recordEvent('NO_SCORE');
    tracker.recordEvent('NO_SCORE');
    expect(tracker.getRecord('P').scores).toHaveLength(1);
  });
});

describe('Tennis FSM minimization', () => {
  it('builds a valid FSM with 5 states', () => {
    const fsm = buildTennisFSM();
    expect(fsm.states.size).toBe(5);
    expect(fsm.alphabet.size).toBe(2);
  });

  it('minimizes tennis FSM (NO_SCORE loops are merged)', () => {
    const result = minimizeTennisFSM();
    // The minimized FSM should have fewer or equal states
    expect(result.minimizedStateCount).toBeLessThanOrEqual(result.originalStateCount);
  });

  it('GAME is an accepting state in minimized FSM', () => {
    const result = minimizeTennisFSM();
    const gameRepresentative = result.stateMap.get('GAME')!;
    expect(result.minimized.acceptingStates.has(gameRepresentative)).toBe(true);
  });
});
