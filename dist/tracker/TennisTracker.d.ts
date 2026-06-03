import type { FSM } from '../types';
export type TennisScore = 'LOVE' | '15' | '30' | '40' | 'GAME';
export type TennisEvent = 'POINT' | 'NO_SCORE';
export interface MatchRecord {
    player: string;
    scores: TennisScore[];
    events: TennisEvent[];
}
export declare class TennisTrackerA {
    private scores;
    private events;
    private static readonly transitions;
    recordEvent(event: TennisEvent): TennisScore;
    getRecord(player: string): MatchRecord;
    reset(): void;
}
export declare class TennisTrackerB {
    private scores;
    private events;
    private static readonly transitions;
    recordEvent(event: TennisEvent): TennisScore;
    getRecord(player: string): MatchRecord;
    reset(): void;
}
export declare function buildTennisFSM(): FSM<TennisScore, TennisEvent>;
export declare function minimizeTennisFSM(): import("../types").MinimizationResult<TennisScore, TennisEvent>;
//# sourceMappingURL=TennisTracker.d.ts.map