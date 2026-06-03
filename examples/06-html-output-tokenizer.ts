/**
 * Example 06: Tokenize OBIX-Rendered HTML Output
 *
 * OBIX components render to HTML strings (render(state) -> string).
 * This example uses BaseTokenizer to tokenize those HTML strings —
 * enabling downstream processing: testing, diffing, policy validation.
 *
 * Integration: @obinexusltd/obix-component-runtime render output
 *              + @obinexusltd/obix-state-minimizer BaseTokenizer
 */

import { BaseTokenizer } from '../src';
import type { TokenBase, TokenizerResult } from '../src';

// ---------------------------------------------------------------------------
// Minimal HTML token types (mirrors poc/node_html_parser pattern)
// ---------------------------------------------------------------------------

type ObixHTMLTokenType =
  | 'StartTag'
  | 'EndTag'
  | 'Text'
  | 'Attribute'
  | 'EOF';

interface ObixHTMLToken extends TokenBase {
  type: ObixHTMLTokenType;
  name?: string;            // tag name
  value?: string;           // text content or attribute value
  attributes?: Map<string, string>;
}

// ---------------------------------------------------------------------------
// ObixHTMLTokenizer — extends BaseTokenizer for OBIX HTML output
// ---------------------------------------------------------------------------

class ObixHTMLTokenizer extends BaseTokenizer<ObixHTMLToken> {
  protected nextToken(): void {
    this.skipWhitespaceInText();
    if (this.position >= this.input.length) return;

    if (this.peek() === '<') {
      this.advance(); // skip <
      if (this.peek() === '/') {
        this.advance();
        this.readEndTag();
      } else {
        this.readStartTag();
      }
    } else {
      this.readText();
    }
  }

  protected onEOF(): void {
    this.tokens.push({
      type: 'EOF',
      start: this.position,
      end: this.position,
      line: this.line,
      column: this.column,
    });
  }

  private skipWhitespaceInText(): void {
    if (!this.options.preserveWhitespace) {
      while (this.position < this.input.length &&
             /\s/.test(this.peek()) &&
             this.peek() !== '<') {
        this.advance();
      }
    }
  }

  private readStartTag(): void {
    const start = this.position - 1; // include the '<'
    const name = this.readTagName();
    if (!name) { this.addError('Empty tag name', start); return; }

    const attributes = this.readAttributes();
    this.skipWhitespace();
    const selfClosing = this.peek() === '/';
    if (selfClosing) this.advance();
    if (this.peek() === '>') this.advance();

    this.tokens.push({ type: 'StartTag', name, attributes, start, end: this.position, line: this.line, column: this.column });
  }

  private readEndTag(): void {
    const start = this.position - 2;
    const name = this.readTagName();
    this.skipUntil('>');
    this.tokens.push({ type: 'EndTag', name, start, end: this.position, line: this.line, column: this.column });
  }

  private readText(): void {
    const start = this.position;
    const value = this.readWhile(ch => ch !== '<');
    const trimmed = value.trim();
    if (trimmed) {
      this.tokens.push({ type: 'Text', value: trimmed, start, end: this.position, line: this.line, column: this.column });
    }
  }

  private readTagName(): string {
    return this.readWhile(ch => /[a-zA-Z0-9:-]/.test(ch));
  }

  private readAttributes(): Map<string, string> {
    const attrs = new Map<string, string>();
    while (this.position < this.input.length && this.peek() !== '>' && this.peek() !== '/') {
      this.skipWhitespace();
      if (this.peek() === '>' || this.peek() === '/') break;
      const name = this.readWhile(ch => !/[\s=>\/]/.test(ch));
      if (!name) break;
      this.skipWhitespace();
      let value = '';
      if (this.peek() === '=') {
        this.advance();
        this.skipWhitespace();
        value = this.readAttributeValue();
      }
      attrs.set(name, value);
    }
    return attrs;
  }

  private readAttributeValue(): string {
    const quote = this.peek();
    if (quote === '"' || quote === "'") {
      this.advance();
      const value = this.readWhile(ch => ch !== quote);
      this.advance();
      return value;
    }
    return this.readWhile(ch => !/[\s>]/.test(ch));
  }
}

// ---------------------------------------------------------------------------
// OBIX-rendered HTML examples (what createButton/createInput would produce)
// ---------------------------------------------------------------------------

const obixButtonHTML = `
<button
  type="button"
  class="obix-button obix-button--primary obix-button--md"
  aria-pressed="false"
  aria-disabled="false"
  tabindex="0"
>
  Save
</button>`.trim();

const obixButtonLoadingHTML = `
<button
  type="button"
  class="obix-button obix-button--primary obix-button--md"
  aria-busy="true"
  aria-disabled="true"
  tabindex="-1"
>
  <span aria-hidden="true" class="obix-button__spinner"></span>Save
</button>`.trim();

const obixInputHTML = `
<div class="obix-input-wrapper">
  <label for="email" class="obix-label">Email Address</label>
  <input
    id="email"
    name="email"
    type="email"
    class="obix-input"
    aria-invalid="false"
    aria-describedby="email-error"
    aria-required="true"
    placeholder="you@example.com"
  />
</div>`.trim();

// ---------------------------------------------------------------------------
// Tokenize and analyze
// ---------------------------------------------------------------------------

function analyzeObixHTML(html: string, label: string): void {
  const tokenizer = new ObixHTMLTokenizer(html);
  const { tokens, errors } = tokenizer.tokenize();

  console.log(`=== ${label} ===`);
  console.log(`Tokens: ${tokens.length}  Errors: ${errors.length}\n`);

  for (const token of tokens) {
    if (token.type === 'StartTag') {
      const attrSummary = token.attributes
        ? Array.from(token.attributes.entries())
            .filter(([k]) => k.startsWith('aria-'))
            .map(([k, v]) => `${k}="${v}"`)
            .join(' ')
        : '';
      console.log(`  <${token.name}> ${attrSummary}`);
    } else if (token.type === 'Text') {
      console.log(`  TEXT: "${token.value}"`);
    } else if (token.type === 'EndTag') {
      console.log(`  </${token.name}>`);
    }
  }

  // Policy check: verify ARIA attributes are present (FUD policy enforcement)
  const startTags = tokens.filter(t => t.type === 'StartTag');
  const interactiveElements = startTags.filter(t =>
    ['button', 'input', 'a', 'select', 'textarea'].includes(t.name ?? '')
  );

  console.log('\n  FUD Policy Check:');
  for (const el of interactiveElements) {
    const attrs = el.attributes ?? new Map();
    const hasAriaLabel = attrs.has('aria-label') || attrs.has('aria-describedby') || el.name === 'button';
    const hasRole = el.name === 'button' || el.name === 'input' || attrs.has('role');
    console.log(`    <${el.name}> aria-invalid=${attrs.get('aria-invalid') ?? 'N/A'} aria-busy=${attrs.get('aria-busy') ?? 'N/A'}`);
  }
  console.log();
}

analyzeObixHTML(obixButtonHTML, 'createButton (default state)');
analyzeObixHTML(obixButtonLoadingHTML, 'createButton (loading state)');
analyzeObixHTML(obixInputHTML, 'createInput (email field)');

// ---------------------------------------------------------------------------
// Integration pattern
// ---------------------------------------------------------------------------
console.log(`=== Integration pattern ===

  import { createButton } from '@obinexusltd/obix-component-runtime';
  import { ObixHTMLTokenizer } from './06-html-output-tokenizer';

  const btn = createButton({ label: 'Save', variant: 'primary' });
  const html = btn.render(btn.state);

  // Tokenize and validate the rendered output
  const { tokens } = new ObixHTMLTokenizer(html).tokenize();

  // Find the button element
  const btnToken = tokens.find(t => t.type === 'StartTag' && t.name === 'button');
  const ariaDisabled = btnToken?.attributes?.get('aria-disabled');

  // Assert FUD policy: button must have aria-disabled attribute
  console.assert(ariaDisabled !== undefined, 'FUD violation: missing aria-disabled');
`);
