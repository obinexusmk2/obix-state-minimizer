export interface TokenBase {
    type: string;
    start: number;
    end: number;
    line: number;
    column: number;
}
export interface TokenizerError {
    message: string;
    severity: 'warning' | 'error';
    line: number;
    column: number;
    start: number;
    end: number;
}
export interface TokenizerResult<T extends TokenBase> {
    tokens: T[];
    errors: TokenizerError[];
}
export interface TokenizerOptions {
    preserveWhitespace?: boolean;
    allowUnclosedTags?: boolean;
    xmlMode?: boolean;
}
export declare abstract class BaseTokenizer<T extends TokenBase> {
    protected input: string;
    protected position: number;
    protected line: number;
    protected column: number;
    protected tokens: T[];
    protected errors: TokenizerError[];
    protected options: Required<TokenizerOptions>;
    constructor(input: string, options?: TokenizerOptions);
    tokenize(): TokenizerResult<T>;
    protected abstract nextToken(): void;
    protected onEOF(): void;
    protected peek(offset?: number): string;
    protected advance(): string;
    protected match(str: string): boolean;
    protected skipWhitespace(): void;
    protected readWhile(predicate: (ch: string) => boolean): string;
    protected skipUntil(target: string): void;
    protected addError(message: string, start: number, severity?: 'warning' | 'error'): void;
}
//# sourceMappingURL=Tokenizer.d.ts.map