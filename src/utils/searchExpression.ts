export type SearchField = 'text' | 'itemId' | 'gameId' | 'tag';

export type SearchTerm = {
  field: SearchField;
  value: string;
  raw: string;
};

export type SearchExpressionNode =
  | { kind: 'term'; term: SearchTerm }
  | { kind: 'and'; children: SearchExpressionNode[] }
  | { kind: 'or'; children: SearchExpressionNode[] }
  | { kind: 'not'; child: SearchExpressionNode };

type Token =
  | { type: 'term'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'or' }
  | { type: 'not' };

function splitDirective(raw: string): [string, string] {
  const idx = raw.search(/[:=]/);
  if (idx < 0) return [raw, ''];
  return [raw.slice(0, idx), raw.slice(idx + 1)];
}

function normalizeSearchValue(raw: string): string {
  return raw.trim().toLowerCase();
}

function tokenizeSearchExpression(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index]!;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === '(') {
      tokens.push({ type: 'lparen' });
      index += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rparen' });
      index += 1;
      continue;
    }
    if (char === '|') {
      tokens.push({ type: 'or' });
      index += 1;
      continue;
    }
    if (char === '!') {
      tokens.push({ type: 'not' });
      index += 1;
      continue;
    }
    if (char === '-') {
      const prev = tokens[tokens.length - 1];
      const next = input[index + 1] ?? '';
      const unaryAllowed = !prev || prev.type === 'lparen' || prev.type === 'or' || prev.type === 'not';
      if (unaryAllowed && next && !/\s/.test(next)) {
        tokens.push({ type: 'not' });
        index += 1;
        continue;
      }
    }

    const start = index;
    while (index < input.length) {
      const current = input[index]!;
      if (/\s/.test(current) || current === '(' || current === ')' || current === '|' || current === '!') {
        break;
      }
      index += 1;
    }
    const value = input.slice(start, index);
    if (value) tokens.push({ type: 'term', value });
  }

  return tokens;
}

function flattenNode(kind: 'and' | 'or', children: SearchExpressionNode[]): SearchExpressionNode {
  const out: SearchExpressionNode[] = [];
  children.forEach((child) => {
    if (child.kind === kind) {
      out.push(...child.children);
    } else {
      out.push(child);
    }
  });
  if (out.length === 1) return out[0]!;
  return { kind, children: out };
}

class SearchExpressionParser {
  private readonly tokens: Token[];

  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): SearchExpressionNode | null {
    return this.parseOr();
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.index + offset];
  }

  private consume(): Token | undefined {
    const token = this.tokens[this.index];
    if (token) this.index += 1;
    return token;
  }

  private parseOr(): SearchExpressionNode | null {
    let left = this.parseAnd();
    while (this.peek()?.type === 'or') {
      this.consume();
      const right = this.parseAnd();
      if (!left && !right) continue;
      if (!left) {
        left = right;
        continue;
      }
      if (!right) continue;
      left = flattenNode('or', [left, right]);
    }
    return left;
  }

  private parseAnd(): SearchExpressionNode | null {
    let left = this.parseUnary();
    while (this.shouldParseImplicitAnd()) {
      const right = this.parseUnary();
      if (!left && !right) continue;
      if (!left) {
        left = right;
        continue;
      }
      if (!right) continue;
      left = flattenNode('and', [left, right]);
    }
    return left;
  }

  private shouldParseImplicitAnd(): boolean {
    const next = this.peek();
    return !!next && (next.type === 'term' || next.type === 'lparen' || next.type === 'not');
  }

  private parseUnary(): SearchExpressionNode | null {
    if (this.peek()?.type === 'not') {
      this.consume();
      const child = this.parseUnary();
      return child ? { kind: 'not', child } : null;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): SearchExpressionNode | null {
    const token = this.peek();
    if (!token) return null;

    if (token.type === 'lparen') {
      this.consume();
      const expr = this.parseOr();
      if (this.peek()?.type === 'rparen') this.consume();
      return expr;
    }

    if (token.type !== 'term') return null;
    this.consume();
    const term = this.parseTerm(token.value);
    return term ? { kind: 'term', term } : null;
  }

  private parseTerm(raw: string): SearchTerm | null {
    if (!raw) return null;
    if (!raw.startsWith('@')) {
      const value = normalizeSearchValue(raw);
      return value ? { field: 'text', value, raw } : null;
    }

    const directive = raw.slice(1);
    const [nameRaw, valueInline] = splitDirective(directive);
    const name = normalizeSearchValue(nameRaw);
    let value = valueInline || '';

    if (!value) {
      const next = this.peek();
      if (next?.type === 'term' && !next.value.startsWith('@')) {
        value = next.value;
        this.consume();
      }
    }

    const normalizedValue = normalizeSearchValue(value);

    if (name === 'itemid' || name === 'id') {
      return normalizedValue ? { field: 'itemId', value: normalizedValue, raw } : null;
    }
    if (name === 'gameid' || name === 'game') {
      return normalizedValue ? { field: 'gameId', value: normalizedValue, raw } : null;
    }
    if (name === 'tag' || name === 't') {
      return normalizedValue ? { field: 'tag', value: normalizedValue, raw } : null;
    }

    const fallback = normalizeSearchValue(directive);
    return fallback ? { field: 'tag', value: fallback, raw } : null;
  }
}

export function parseSearchExpression(input: string): SearchExpressionNode | null {
  const tokens = tokenizeSearchExpression(input);
  if (!tokens.length) return null;
  const parser = new SearchExpressionParser(tokens);
  return parser.parse();
}

export function evaluateSearchExpression(
  expression: SearchExpressionNode | null,
  matcher: (term: SearchTerm) => boolean,
): boolean {
  if (!expression) return true;
  switch (expression.kind) {
    case 'term':
      return matcher(expression.term);
    case 'and':
      return expression.children.every((child) => evaluateSearchExpression(child, matcher));
    case 'or':
      return expression.children.some((child) => evaluateSearchExpression(child, matcher));
    case 'not':
      return !evaluateSearchExpression(expression.child, matcher);
  }
}
