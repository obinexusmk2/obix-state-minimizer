import type { FSM } from '../types';
import { minimizeFSM } from '../minimizer/StateMinimizer';

export type TennisScore = 'LOVE' | '15' | '30' | '40' | 'GAME';
export type TennisEvent = 'POINT' | 'NO_SCORE';

export interface MatchRecord {
  player: string;
  scores: TennisScore[];
  events: TennisEvent[];
}

export class TennisTrackerA {
  private scores: TennisScore[] = ['LOVE'];
  private events: TennisEvent[] = [];

  private static readonly transitions: Record<TennisScore, TennisScore> = {
    LOVE: '15', '15': '30', '30': '40', '40': 'GAME', GAME: 'GAME',
  };

  recordEvent(event: TennisEvent): TennisScore {
    this.events.push(event);
    if (event === 'POINT') {
      const current = this.scores[this.scores.length - 1];
      const next = TennisTrackerA.transitions[current];
      this.scores.push(next);
      return next;
    }
    const current = this.scores[this.scores.length - 1];
    this.scores.push(current);
    return current;
  }

  getRecord(player: string): MatchRecord {
    return { player, scores: [...this.scores], events: [...this.events] };
  }

  reset(): void { this.scores = ['LOVE']; this.events = []; }
}

export class TennisTrackerB {
  private scores: TennisScore[] = ['LOVE'];
  private events: TennisEvent[] = [];

  private static readonly transitions: Record<TennisScore, TennisScore> = {
    LOVE: '15', '15': '30', '30': '40', '40': 'GAME', GAME: 'GAME',
  };

  recordEvent(event: TennisEvent): TennisScore {
    this.events.push(event);
    if (event === 'NO_SCORE') {
      return this.scores[this.scores.length - 1];
    }
    const current = this.scores[this.scores.length - 1];
    const next = TennisTrackerB.transitions[current];
    this.scores.push(next);
    return next;
  }

  getRecord(player: string): MatchRecord {
    return { player, scores: [...this.scores], events: [...this.events] };
  }

  reset(): void { this.scores = ['LOVE']; this.events = []; }
}

export function buildTennisFSM(): FSM<TennisScore, TennisEvent> {
  const states = new Set<TennisScore>(['LOVE', '15', '30', '40', 'GAME']);
  const alphabet = new Set<TennisEvent>(['POINT', 'NO_SCORE']);
  const acceptingStates = new Set<TennisScore>(['GAME']);

  const table: Record<TennisScore, Partial<Record<TennisEvent, TennisScore>>> = {
    LOVE: { POINT: '15', NO_SCORE: 'LOVE' },
    '15': { POINT: '30', NO_SCORE: '15' },
    '30': { POINT: '40', NO_SCORE: '30' },
    '40': { POINT: 'GAME', NO_SCORE: '40' },
    GAME: { POINT: 'GAME', NO_SCORE: 'GAME' },
  };

  const transition = (state: TennisScore, symbol: TennisEvent) => table[state][symbol];
  return { states, alphabet, transition, initialState: 'LOVE', acceptingStates };
}

export function minimizeTennisFSM() {
  return minimizeFSM(buildTennisFSM());
}
