"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseParser = exports.createNode = exports.createState = void 0;
const PartitionRefinement_1 = require("../minimizer/PartitionRefinement");
function createState(type, isAccepting) {
    return { type, isAccepting, transitions: new Map() };
}
exports.createState = createState;
function createNode(type, partial) {
    return { type, children: [], metadata: { equivalenceClass: -1, isMinimized: false }, ...partial };
}
exports.createNode = createNode;
class BaseParser {
    constructor() {
        this.states = new Set();
        this.equivalenceClasses = new Map();
        this.initializeStates();
    }
    minimizeParserStates() {
        const originalCount = this.states.size;
        const stateLabels = new Map();
        let i = 0;
        for (const s of this.states)
            stateLabels.set(s, `s${i++}`);
        const alphabet = new Set();
        for (const s of this.states)
            for (const sym of s.transitions.keys())
                alphabet.add(sym);
        const acceptingLabels = new Set();
        for (const s of this.states)
            if (s.isAccepting)
                acceptingLabels.add(stateLabels.get(s));
        const fsm = {
            states: new Set(stateLabels.values()),
            alphabet,
            initialState: stateLabels.get(this.currentState),
            acceptingStates: acceptingLabels,
            transition(state, symbol) {
                for (const [ps, label] of stateLabels) {
                    if (label === state) {
                        const target = ps.transitions.get(symbol);
                        return target ? stateLabels.get(target) : undefined;
                    }
                }
                return undefined;
            },
        };
        const partition = (0, PartitionRefinement_1.partitionRefinement)(fsm);
        this.equivalenceClasses.clear();
        partition.forEach((cls, idx) => {
            const parserStates = new Set();
            for (const label of cls) {
                for (const [ps, l] of stateLabels) {
                    if (l === label)
                        parserStates.add(ps);
                }
            }
            this.equivalenceClasses.set(idx, parserStates);
        });
        return {
            originalStateCount: originalCount,
            minimizedStateCount: partition.length,
            optimizationRatio: partition.length / originalCount,
        };
    }
    getEquivalenceClass(state) {
        for (const [classId, states] of this.equivalenceClasses) {
            if (states.has(state))
                return classId;
        }
        return -1;
    }
    transition(symbol) {
        const next = this.currentState.transitions.get(symbol);
        if (next)
            this.currentState = next;
    }
    parse(tokens) {
        const metrics = this.minimizeParserStates();
        const root = createNode('Root', { name: 'root' });
        const stack = [root];
        let current = root;
        for (const token of tokens)
            current = this.processToken(token, current, stack);
        return { root, metrics };
    }
}
exports.BaseParser = BaseParser;
//# sourceMappingURL=Parser.js.map