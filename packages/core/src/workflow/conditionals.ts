/**
 * Evaluate a simple condition expression against workflow context.
 *
 * Supports:
 * - "always" -> true
 * - "never" -> false
 * - "output_name == 'value'" — equality check
 * - "output_name != 'value'" — inequality check
 * - "'value' in output_name" — substring/membership check
 * - "condition1 and condition2" — logical AND
 * - "condition1 or condition2" — logical OR
 * - "not condition" — logical NOT
 * - Dot access: "agent_output.field" to access nested values
 */
export function evaluateCondition(
  expression: string,
  context: Record<string, unknown>,
): boolean {
  const trimmed = expression.trim();

  // Empty or undefined expressions default to true
  if (!trimmed) {
    return true;
  }

  return evaluateOr(trimmed, context);
}

/**
 * Lowest precedence: split on ' or '
 */
function evaluateOr(expr: string, context: Record<string, unknown>): boolean {
  const parts = splitOnKeyword(expr, ' or ');
  if (parts.length === 1) {
    return evaluateAnd(parts[0]!, context);
  }
  return parts.some(part => evaluateAnd(part, context));
}

/**
 * Next precedence: split on ' and '
 */
function evaluateAnd(expr: string, context: Record<string, unknown>): boolean {
  const parts = splitOnKeyword(expr, ' and ');
  if (parts.length === 1) {
    return evaluateNot(parts[0]!, context);
  }
  return parts.every(part => evaluateNot(part, context));
}

/**
 * Handle 'not ' prefix
 */
function evaluateNot(expr: string, context: Record<string, unknown>): boolean {
  const trimmed = expr.trim();
  if (trimmed.toLowerCase().startsWith('not ')) {
    return !evaluateNot(trimmed.slice(4), context);
  }
  return evaluateAtom(trimmed, context);
}

/**
 * Evaluate an atomic expression: keyword, comparison, or membership test.
 */
function evaluateAtom(expr: string, context: Record<string, unknown>): boolean {
  const trimmed = expr.trim();
  const lower = trimmed.toLowerCase();

  // Keywords
  if (lower === 'always') return true;
  if (lower === 'never') return false;

  // Equality: output_name == 'value'
  if (trimmed.includes('==')) {
    const [left, right] = splitFirst(trimmed, '==');
    const leftVal = resolveValue(left!.trim(), context);
    const rightVal = resolveValue(right!.trim(), context);
    return String(leftVal) === String(rightVal);
  }

  // Inequality: output_name != 'value'
  if (trimmed.includes('!=')) {
    const [left, right] = splitFirst(trimmed, '!=');
    const leftVal = resolveValue(left!.trim(), context);
    const rightVal = resolveValue(right!.trim(), context);
    return String(leftVal) !== String(rightVal);
  }

  // Membership: 'value' in output_name
  const inMatch = trimmed.match(/^(.+?)\s+in\s+(.+)$/i);
  if (inMatch) {
    const needle = resolveValue(inMatch[1]!.trim(), context);
    const haystack = resolveValue(inMatch[2]!.trim(), context);
    const needleStr = String(needle);
    if (Array.isArray(haystack)) {
      return haystack.some(item => String(item) === needleStr);
    }
    return String(haystack).includes(needleStr);
  }

  // If it's a bare reference, treat it as truthy check
  const val = resolveValue(trimmed, context);
  return Boolean(val);
}

/**
 * Resolve a value: either a quoted string literal or a dot-path context reference.
 */
function resolveValue(token: string, context: Record<string, unknown>): unknown {
  // String literal in single or double quotes
  if (
    (token.startsWith("'") && token.endsWith("'")) ||
    (token.startsWith('"') && token.endsWith('"'))
  ) {
    return token.slice(1, -1);
  }

  // Numeric literal
  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return Number(token);
  }

  // Boolean literals
  if (token.toLowerCase() === 'true') return true;
  if (token.toLowerCase() === 'false') return false;

  // Dot-path reference into context
  return resolveDotPath(token, context);
}

/**
 * Resolve a dot-separated path against a context object.
 * e.g. "research.summary" -> context["research"]["summary"]
 */
function resolveDotPath(path: string, context: Record<string, unknown>): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Split a string on a keyword, but only at the top level (not inside quotes).
 */
function splitOnKeyword(expr: string, keyword: string): string[] {
  const parts: string[] = [];
  let current = '';
  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  while (i < expr.length) {
    if (expr[i] === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += expr[i];
      i++;
    } else if (expr[i] === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += expr[i];
      i++;
    } else if (
      !inSingleQuote &&
      !inDoubleQuote &&
      expr.substring(i, i + keyword.length).toLowerCase() === keyword.toLowerCase()
    ) {
      parts.push(current);
      current = '';
      i += keyword.length;
    } else {
      current += expr[i];
      i++;
    }
  }

  parts.push(current);
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Split on the first occurrence of a delimiter.
 */
function splitFirst(str: string, delimiter: string): [string, string] {
  const idx = str.indexOf(delimiter);
  if (idx === -1) return [str, ''];
  return [str.substring(0, idx), str.substring(idx + delimiter.length)];
}
