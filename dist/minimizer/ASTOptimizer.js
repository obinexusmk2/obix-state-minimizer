"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getASTMetrics = exports.buildAST = exports.ASTOptimizer = void 0;
class ASTOptimizer {
    constructor(fsm, result) {
        this.fsm = fsm;
        this.result = result;
        this.stateClasses = new Map();
    }
    buildOptimizedAST() {
        const { minimized } = this.result;
        const visited = new Map();
        const raw = this.buildNode(minimized.initialState, minimized, visited);
        // Pass the visited map so buildStateClasses won't recurse into cycles
        this.buildStateClasses(visited);
        return raw;
    }
    // Build equivalence classes from the flat set of visited nodes (cycle-safe)
    buildStateClasses(visited) {
        const sigMap = new Map();
        for (const node of visited.values()) {
            const sig = this.computeNodeSignature(node);
            if (!sigMap.has(sig))
                sigMap.set(sig, new Set());
            sigMap.get(sig).add(node);
        }
        let id = 0;
        for (const [sig, nodes] of sigMap) {
            if (nodes.size > 1) {
                this.stateClasses.set(id++, {
                    signature: sig,
                    nodes: nodes,
                });
            }
        }
    }
    computeNodeSignature(node) {
        const childStates = Array.from(node.children.values()).map((c) => c.state).join(',');
        return `${node.state}|accepting:${node.accepting}|children:[${childStates}]`;
    }
    buildNode(state, fsm, visited) {
        if (visited.has(state))
            return visited.get(state);
        const node = {
            state,
            children: new Map(),
            accepting: fsm.acceptingStates.has(state),
        };
        visited.set(state, node);
        for (const symbol of fsm.alphabet) {
            const next = fsm.transition(state, symbol);
            if (next !== undefined)
                node.children.set(symbol, this.buildNode(next, fsm, visited));
        }
        return node;
    }
    computeMetrics() {
        const classCount = this.stateClasses.size;
        const avgSize = classCount > 0
            ? Array.from(this.stateClasses.values()).reduce((acc, c) => acc + c.nodes.size, 0) / classCount
            : 0;
        return {
            nodeReduction: {
                original: this.result.originalStateCount,
                optimized: this.result.minimizedStateCount,
                ratio: this.result.minimizedStateCount / this.result.originalStateCount,
            },
            stateClasses: { count: classCount, averageSize: avgSize },
            equivalenceClassCount: classCount,
        };
    }
    static serialize(node, indent = 0, seen = new Set()) {
        const prefix = '  '.repeat(indent);
        const marker = node.accepting ? ' [ACCEPT]' : '';
        let out = `${prefix}[${node.state}]${marker}\n`;
        if (seen.has(node.state))
            return out + `${prefix}  <cycle>\n`;
        seen.add(node.state);
        for (const [sym, child] of node.children) {
            out += `${prefix}  --${sym}-->\n`;
            out += ASTOptimizer.serialize(child, indent + 2, new Set(seen));
        }
        return out;
    }
}
exports.ASTOptimizer = ASTOptimizer;
function buildAST(fsm, result) {
    return new ASTOptimizer(fsm, result).buildOptimizedAST();
}
exports.buildAST = buildAST;
function getASTMetrics(fsm, result) {
    const optimizer = new ASTOptimizer(fsm, result);
    optimizer.buildOptimizedAST();
    return optimizer.computeMetrics();
}
exports.getASTMetrics = getASTMetrics;
//# sourceMappingURL=ASTOptimizer.js.map