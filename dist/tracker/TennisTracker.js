"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.minimizeTennisFSM = exports.buildTennisFSM = exports.TennisTrackerB = exports.TennisTrackerA = void 0;
const StateMinimizer_1 = require("../minimizer/StateMinimizer");
class TennisTrackerA {
    constructor() {
        this.scores = ['LOVE'];
        this.events = [];
    }
    recordEvent(event) {
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
    getRecord(player) {
        return { player, scores: [...this.scores], events: [...this.events] };
    }
    reset() { this.scores = ['LOVE']; this.events = []; }
}
exports.TennisTrackerA = TennisTrackerA;
TennisTrackerA.transitions = {
    LOVE: '15', '15': '30', '30': '40', '40': 'GAME', GAME: 'GAME',
};
class TennisTrackerB {
    constructor() {
        this.scores = ['LOVE'];
        this.events = [];
    }
    recordEvent(event) {
        this.events.push(event);
        if (event === 'NO_SCORE') {
            return this.scores[this.scores.length - 1];
        }
        const current = this.scores[this.scores.length - 1];
        const next = TennisTrackerB.transitions[current];
        this.scores.push(next);
        return next;
    }
    getRecord(player) {
        return { player, scores: [...this.scores], events: [...this.events] };
    }
    reset() { this.scores = ['LOVE']; this.events = []; }
}
exports.TennisTrackerB = TennisTrackerB;
TennisTrackerB.transitions = {
    LOVE: '15', '15': '30', '30': '40', '40': 'GAME', GAME: 'GAME',
};
function buildTennisFSM() {
    const states = new Set(['LOVE', '15', '30', '40', 'GAME']);
    const alphabet = new Set(['POINT', 'NO_SCORE']);
    const acceptingStates = new Set(['GAME']);
    const table = {
        LOVE: { POINT: '15', NO_SCORE: 'LOVE' },
        '15': { POINT: '30', NO_SCORE: '15' },
        '30': { POINT: '40', NO_SCORE: '30' },
        '40': { POINT: 'GAME', NO_SCORE: '40' },
        GAME: { POINT: 'GAME', NO_SCORE: 'GAME' },
    };
    const transition = (state, symbol) => table[state][symbol];
    return { states, alphabet, transition, initialState: 'LOVE', acceptingStates };
}
exports.buildTennisFSM = buildTennisFSM;
function minimizeTennisFSM() {
    return (0, StateMinimizer_1.minimizeFSM)(buildTennisFSM());
}
exports.minimizeTennisFSM = minimizeTennisFSM;
//# sourceMappingURL=TennisTracker.js.map