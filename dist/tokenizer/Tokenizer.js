"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTokenizer = void 0;
class BaseTokenizer {
    constructor(input, options = {}) {
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
        this.errors = [];
        this.input = input;
        this.options = {
            preserveWhitespace: false,
            allowUnclosedTags: true,
            xmlMode: false,
            ...options,
        };
    }
    tokenize() {
        while (this.position < this.input.length) {
            this.nextToken();
        }
        this.onEOF();
        return { tokens: this.tokens, errors: this.errors };
    }
    onEOF() { }
    peek(offset = 0) {
        return this.input[this.position + offset] ?? '';
    }
    advance() {
        const ch = this.input[this.position];
        if (ch === '\n') {
            this.line++;
            this.column = 1;
        }
        else {
            this.column++;
        }
        this.position++;
        return ch;
    }
    match(str) {
        return this.input.startsWith(str, this.position);
    }
    skipWhitespace() {
        while (this.position < this.input.length && /\s/.test(this.peek())) {
            this.advance();
        }
    }
    readWhile(predicate) {
        let result = '';
        while (this.position < this.input.length && predicate(this.peek())) {
            result += this.advance();
        }
        return result;
    }
    skipUntil(target) {
        while (this.position < this.input.length && !this.match(target)) {
            this.advance();
        }
        for (let i = 0; i < target.length; i++)
            this.advance();
    }
    addError(message, start, severity = 'error') {
        this.errors.push({ message, severity, start, end: this.position, line: this.line, column: this.column });
    }
}
exports.BaseTokenizer = BaseTokenizer;
//# sourceMappingURL=Tokenizer.js.map