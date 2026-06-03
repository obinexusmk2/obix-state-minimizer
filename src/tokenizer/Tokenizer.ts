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

export abstract class BaseTokenizer<T extends TokenBase> {
  protected input: string;
  protected position = 0;
  protected line = 1;
  protected column = 1;
  protected tokens: T[] = [];
  protected errors: TokenizerError[] = [];
  protected options: Required<TokenizerOptions>;

  constructor(input: string, options: TokenizerOptions = {}) {
    this.input = input;
    this.options = {
      preserveWhitespace: false,
      allowUnclosedTags: true,
      xmlMode: false,
      ...options,
    };
  }

  tokenize(): TokenizerResult<T> {
    while (this.position < this.input.length) {
      this.nextToken();
    }
    this.onEOF();
    return { tokens: this.tokens, errors: this.errors };
  }

  protected abstract nextToken(): void;
  protected onEOF(): void {}

  protected peek(offset = 0): string {
    return this.input[this.position + offset] ?? '';
  }

  protected advance(): string {
    const ch = this.input[this.position];
    if (ch === '\n') { this.line++; this.column = 1; }
    else { this.column++; }
    this.position++;
    return ch;
  }

  protected match(str: string): boolean {
    return this.input.startsWith(str, this.position);
  }

  protected skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.peek())) {
      this.advance();
    }
  }

  protected readWhile(predicate: (ch: string) => boolean): string {
    let result = '';
    while (this.position < this.input.length && predicate(this.peek())) {
      result += this.advance();
    }
    return result;
  }

  protected skipUntil(target: string): void {
    while (this.position < this.input.length && !this.match(target)) {
      this.advance();
    }
    for (let i = 0; i < target.length; i++) this.advance();
  }

  protected addError(message: string, start: number, severity: 'warning' | 'error' = 'error'): void {
    this.errors.push({ message, severity, start, end: this.position, line: this.line, column: this.column });
  }
}
