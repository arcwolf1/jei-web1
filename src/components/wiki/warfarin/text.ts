import type { ItemDef } from 'src/jei/types';
import { attributeTypeNames } from './genums';

type RecordLike = Record<string, unknown>;

export interface WarfarinRenderContext {
  localNameMap?: RecordLike | undefined;
  idToPackItemId?: RecordLike | undefined;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
  refs?: RecordLike | undefined;
  blackboard?: Record<string, number> | undefined;
  semantic?: boolean | undefined;
}

const referenceLabelOverrides: Record<string, string> = {
  'ba.key': 'Keyword',
  'ba.vup': 'Increase',
  'ba.return': 'Recover',
  'ba.info': 'Info',
  'ba.consume': 'Consume',
  'ba.poise': 'Stagger',
};

const referenceClassByPrefix: Record<string, string> = {
  ba: 'ww__inline--battle',
  item: 'ww__inline--item',
  sys: 'ww__inline--system',
  adv: 'ww__inline--system',
  fac: 'ww__inline--system',
  qu: 'ww__inline--accent',
  gd: 'ww__inline--accent',
  obt: 'ww__inline--accent',
  tips: 'ww__inline--accent',
  nar: 'ww__inline--muted',
  profile: 'ww__inline--muted',
};

const referenceClassByToken: Record<string, string> = {
  'tips.orange': 'ww__inline--tips-orange',
  'tips.purple': 'ww__inline--tips-purple',
};

const positiveBattleTokens = new Set([
  'vup',
  'return',
  'heal',
  'info',
  'consume',
  'speedup',
]);

const negativeBattleTokens = new Set(['vdown']);

const statusBattleTokens = new Set([
  'key',
  'noguard',
  'airborne',
  'lastcombo',
  'crush',
  'knockdown',
  'fracture',
  'guard',
  'shield',
  'weak',
  'combo',
  'dispel',
  'slow',
  'vulnerable',
  'statuslevel',
  'dot',
  'poiseknot',
  'enhance',
]);

const physicalBattleTokens = new Set(['pd', 'phy', 'poise', 'physicalstatus', 'physicalvul']);
const spellBattleTokens = new Set([
  'spelldmg',
  'spellstatus',
  'spellinflict',
  'spellinflictonchar',
  'spellburst',
  'spellvul',
  'spellenhance',
]);
const fireBattleTokens = new Set([
  'fire',
  'fireinflict',
  'fireburst',
  'firevul',
  'fireenhance',
  'burning',
  'burningonchar',
]);
const crystBattleTokens = new Set([
  'cryst',
  'crystinflict',
  'crystbreak',
  'crystburst',
  'crystvul',
  'crystenhance',
  'crystonchar',
  'frozen',
  'frozenonchar',
]);
const pulseBattleTokens = new Set([
  'pulse',
  'pulseinflict',
  'pulseburst',
  'pulsevul',
  'pulseenhance',
  'conduct',
  'conductonchar',
]);
const naturalBattleTokens = new Set([
  'natur',
  'naturalinflict',
  'naturalburst',
  'naturalenhance',
  'corrupt',
  'corruptonchar',
]);
const originiumBattleTokens = new Set(['originium', 'ether']);

const skillParamTypeNames: Record<number, string> = {
  1: 'costvalue',
  2: 'coolDown',
};

function isRecordLike(value: unknown): value is RecordLike {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeAllowedHtmlTag(tag: string): string {
  const trimmed = tag.trim();
  const closing = /^<\//.test(trimmed);
  const match = trimmed.match(/^<\/?\s*([a-z0-9]+)/i);
  const name = match?.[1]?.toLowerCase();
  if (!name) return '';
  if (name === 'br') return '<br>';
  return closing ? `</${name}>` : `<${name}>`;
}

function preserveBasicHtmlTags(input: string, store: (html: string) => string): string {
  return input.replace(
    /<\/?\s*(?:b|strong|i|em|u|br|p|ul|ol|li|code|pre)\s*\/?>/gi,
    (match) => store(normalizeAllowedHtmlTag(match)),
  );
}

function escapeHtmlAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function formatScalar(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(3).replace(/\.?0+$/, '');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean);
}

function toCdnAssetUrl(assetId: unknown): string {
  const id = typeof assetId === 'string' ? assetId.trim() : '';
  return id ? `https://cdn.warfarin.wiki/assets/${id}.png` : '';
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_./-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveEntityName(id: unknown, localNameMap?: RecordLike): string {
  const strId = typeof id === 'string' ? id : '';
  if (!strId) return '-';
  if (typeof localNameMap?.[strId] === 'string') return String(localNameMap[strId]);
  return strId;
}

function collectReferenceName(value: unknown): string | undefined {
  if (!isRecordLike(value)) return undefined;
  const candidate = [value.tagName, value.blocName, value.name, value.title, value.label, value.engName]
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .find((entry) => entry.length > 0);
  return candidate || undefined;
}

function resolveReferenceName(id: string, refs?: RecordLike): string | undefined {
  if (!id || !refs) return undefined;
  const direct = collectReferenceName(refs[id]);
  if (direct) return direct;

  for (const tableName of ['tagDataTable', 'blocDataTable', 'charTypeTable', 'charProfessionTable']) {
    const table = refs[tableName];
    if (!isRecordLike(table)) continue;

    const byKey = collectReferenceName(table[id]);
    if (byKey) return byKey;

    for (const entry of Object.values(table)) {
      if (!isRecordLike(entry)) continue;
      const entryIds = [entry.tagId, entry.id, entry.blocId]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0);
      if (!entryIds.includes(id)) continue;
      const nested = collectReferenceName(entry);
      if (nested) return nested;
    }
  }

  return undefined;
}

function findItemDefByRawId(
  rawId: unknown,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): ItemDef | undefined {
  const itemId = typeof rawId === 'string' ? rawId.trim() : '';
  if (!itemId || !itemDefsByKeyHash) return undefined;
  return Object.values(itemDefsByKeyHash).find((entry) => {
    const fullId = typeof entry?.key?.id === 'string' ? entry.key.id : '';
    return fullId === itemId || fullId.endsWith(itemId);
  });
}

function findItemDefByPackItemId(
  packItemId: string | undefined,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): ItemDef | undefined {
  const itemId = typeof packItemId === 'string' ? packItemId.trim() : '';
  if (!itemId || !itemDefsByKeyHash) return undefined;
  return Object.values(itemDefsByKeyHash).find((entry) => {
    const fullId = typeof entry?.key?.id === 'string' ? entry.key.id : '';
    return fullId === itemId;
  });
}

function resolvePackItemId(
  rawId: string,
  idToPackItemId?: RecordLike,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string | undefined {
  if (!rawId) return undefined;
  const mapped = idToPackItemId?.[rawId];
  if (typeof mapped === 'string' && mapped.trim().length > 0) return mapped.trim();
  if (itemDefsByKeyHash && rawId.startsWith('item_')) {
    const exactJeiwebItemId = `endfield.warfarin.items_${rawId}`;
    const exactDef = findItemDefByPackItemId(exactJeiwebItemId, itemDefsByKeyHash);
    if (exactDef) return exactDef.key.id;
  }
  const def = findItemDefByRawId(rawId, itemDefsByKeyHash);
  return def?.key.id;
}

function resolveItemNameFromDefs(
  rawId: string,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string {
  if (!rawId) return '-';
  return findItemDefByRawId(rawId, itemDefsByKeyHash)?.name || rawId;
}

export function stripWikiText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean)
    .replace(/<image="([^"]+)"(?:\s+scale=[^>]+)?\s*\/>/g, '')
    .replace(/<[@#][^>]+>/g, '')
    .replace(/<\/>/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function pickWarfarinText(source: unknown): unknown {
  if (!isRecordLike(source)) return source;
  if (typeof source.desc === 'string' && source.desc.trim().length > 0) {
    return source.desc;
  }
  if (typeof source.description === 'string' && source.description.trim().length > 0) {
    return source.description;
  }
  if (typeof source.renderedDesc === 'string' && source.renderedDesc.trim().length > 0) {
    return source.renderedDesc;
  }
  if (
    typeof source.renderedDescription === 'string' &&
    source.renderedDescription.trim().length > 0
  ) {
    return source.renderedDescription;
  }
  return '';
}

function resolveReferenceLabel(token: string, context: WarfarinRenderContext, fallback = ''): string {
  if (fallback.trim()) return fallback.trim();
  const rawToken = token.trim();
  if (!rawToken) return '';
  if (referenceLabelOverrides[rawToken]) return referenceLabelOverrides[rawToken];
  if (rawToken.startsWith('item.')) {
    const rawItemId = rawToken.slice('item.'.length);
    const byLocalName = resolveEntityName(rawItemId, context.localNameMap);
    if (byLocalName && byLocalName !== rawItemId) return byLocalName;
    const byDefs = resolveItemNameFromDefs(rawItemId, context.itemDefsByKeyHash);
    if (byDefs && byDefs !== rawItemId) return byDefs;
  }
  const ref = context.refs?.[rawToken];
  if (isRecordLike(ref)) {
    const candidate = [ref.name, ref.title, ref.label, ref.id]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find((value) => value.length > 0);
    if (candidate) return candidate;
  }
  const nestedRef = resolveReferenceName(rawToken, context.refs);
  if (nestedRef) return nestedRef;
  const tail = rawToken.split('.').filter(Boolean).at(-1) || rawToken;
  return humanizeKey(tail);
}

function classNameFromToken(token: string, marker: string): string {
  if (referenceClassByToken[token]) return referenceClassByToken[token];
  const [prefix = '', tail = ''] = token.split('.').filter(Boolean);
  if (prefix === 'ba') {
    if (positiveBattleTokens.has(tail)) return 'ww__inline--positive';
    if (negativeBattleTokens.has(tail)) return 'ww__inline--negative';
    if (physicalBattleTokens.has(tail)) return 'ww__inline--physical';
    if (spellBattleTokens.has(tail)) return 'ww__inline--spell';
    if (fireBattleTokens.has(tail)) return 'ww__inline--fire';
    if (crystBattleTokens.has(tail)) return 'ww__inline--cryst';
    if (pulseBattleTokens.has(tail)) return 'ww__inline--pulse';
    if (naturalBattleTokens.has(tail)) return 'ww__inline--natural';
    if (originiumBattleTokens.has(tail)) return 'ww__inline--originium';
    if (statusBattleTokens.has(tail)) return 'ww__inline--status';
    return marker === '#' ? 'ww__inline--status' : 'ww__inline--battle';
  }
  if (marker === '#' && (prefix === 'qu' || prefix === 'gd' || prefix === 'obt' || prefix === 'tips')) {
    return 'ww__inline--accent';
  }
  return referenceClassByPrefix[prefix] || 'ww__inline--accent';
}

export function buildWarfarinBlackboardMap(source: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecordLike(value)) return;
    if (typeof value.key === 'string' && typeof value.value === 'number') {
      out[value.key] = value.value;
    }
    if (typeof value.bbKey === 'string' && typeof value.floatValue === 'number') {
      out[value.bbKey] = value.floatValue;
    }
    const attrModifier = isRecordLike(value.attrModifier) ? value.attrModifier : null;
    if (
      attrModifier &&
      typeof attrModifier.attrType === 'number' &&
      typeof attrModifier.attrValue === 'number'
    ) {
      const attrName = attributeTypeNames[attrModifier.attrType];
      if (typeof attrName === 'string' && attrName.trim().length > 0) {
        out[attrName] = attrModifier.attrValue;
      }
    }
    const skillParamModifier = isRecordLike(value.skillParamModifier)
      ? value.skillParamModifier
      : null;
    if (
      skillParamModifier &&
      typeof skillParamModifier.paramType === 'number' &&
      typeof skillParamModifier.paramValue === 'number'
    ) {
      const paramName = skillParamTypeNames[skillParamModifier.paramType];
      if (paramName) out[paramName] = skillParamModifier.paramValue;
    }
    if (typeof value.coolDown === 'number') out.coolDown = value.coolDown;
    if (typeof value.costValue === 'number') out.costvalue = value.costValue;
    for (const child of Object.values(value)) visit(child);
  };
  visit(source);
  return out;
}

function mergeBlackboardMaps(
  explicit: Record<string, number> | undefined,
  source: unknown,
): Record<string, number> {
  return {
    ...buildWarfarinBlackboardMap(source),
    ...(explicit ?? {}),
  };
}

function parseNumericExpression(input: string): number | null {
  let index = 0;

  const skipWhitespace = () => {
    while (index < input.length && /\s/.test(input[index] || '')) index += 1;
  };

  const parseNumber = (): number | null => {
    skipWhitespace();
    const rest = input.slice(index);
    const match = rest.match(/^\d+(?:\.\d+)?/);
    if (!match) return null;
    index += match[0].length;
    return Number(match[0]);
  };

  const parseFactor = (): number | null => {
    skipWhitespace();
    const char = input[index];
    if (char === '+') {
      index += 1;
      return parseFactor();
    }
    if (char === '-') {
      index += 1;
      const value = parseFactor();
      return value === null ? null : -value;
    }
    if (char === '(') {
      index += 1;
      const value = parseExpression();
      skipWhitespace();
      if (value === null || input[index] !== ')') return null;
      index += 1;
      return value;
    }
    return parseNumber();
  };

  const parseTerm = (): number | null => {
    let value = parseFactor();
    if (value === null) return null;
    while (true) {
      skipWhitespace();
      const operator = input[index];
      if (operator !== '*' && operator !== '/') break;
      index += 1;
      const right = parseFactor();
      if (right === null) return null;
      value = operator === '*' ? value * right : value / right;
    }
    return Number.isFinite(value) ? value : null;
  };

  const parseExpression = (): number | null => {
    let value = parseTerm();
    if (value === null) return null;
    while (true) {
      skipWhitespace();
      const operator = input[index];
      if (operator !== '+' && operator !== '-') break;
      index += 1;
      const right = parseTerm();
      if (right === null) return null;
      value = operator === '+' ? value + right : value - right;
    }
    return Number.isFinite(value) ? value : null;
  };

  const result = parseExpression();
  skipWhitespace();
  return result !== null && index === input.length ? result : null;
}

function evaluatePlaceholderExpression(expr: string, blackboard: Record<string, number>): number | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;
  const isInverse = trimmed.startsWith('1-');
  const normalized = isInverse ? trimmed.slice(2) : trimmed;
  if (normalized in blackboard) {
    const base = blackboard[normalized] ?? null;
    return base === null ? null : isInverse ? 1 - base : base;
  }
  const replaced = normalized.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (token) => {
    if (token in blackboard) return String(blackboard[token]);
    return token;
  });
  if (!/^[0-9+\-*/().\s]+$/.test(replaced)) return null;
  const computed = parseNumericExpression(replaced);
  if (computed === null) return null;
  return isInverse ? 1 - computed : computed;
}

function formatByPattern(value: number, format: string): string {
  const trimmed = format.trim();
  if (!trimmed) return formatScalar(value);
  if (/^0+(?:\.0+)?%$/.test(trimmed)) {
    const decimals = (trimmed.split('.')[1] ?? '').replace('%', '').length;
    return `${(value * 100).toFixed(decimals)}%`;
  }
  if (/^0+(?:\.0+)?$/.test(trimmed)) {
    const decimals = (trimmed.split('.')[1] ?? '').length;
    return value.toFixed(decimals).replace(/\.?0+$/, decimals > 0 ? '' : '$&');
  }
  return formatScalar(value);
}

function renderPlaceholderHtml(
  rawExpr: string,
  source: unknown,
  context: WarfarinRenderContext,
): string {
  const [expr = rawExpr, format = ''] = rawExpr.split(':');
  const blackboard = mergeBlackboardMaps(context.blackboard, source);
  const value = evaluatePlaceholderExpression(expr, blackboard);
  if (value === null) return escapeHtml(`{${rawExpr}}`);
  const rendered = escapeHtml(formatByPattern(value, format));
  if (!context.semantic) return rendered;
  return `<span class="ww__inline-value">${rendered}</span>`;
}

export function renderWarfarinTextHtml(
  value: unknown,
  context: WarfarinRenderContext = {},
): string {
  const text = stripWikiText(value);
  if (!text) return '';

  const placeholders: string[] = [];
  const store = (html: string): string => {
    const id = placeholders.length;
    placeholders.push(html);
    return `%%WW${id}%%`;
  };

  let working =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);

  const renderInlineFragment = (fragment: string): string =>
    escapeHtml(preserveBasicHtmlTags(fragment, store))
      .replace(/\{([^{}]+)\}/g, (_match, expr: string) =>
        store(renderPlaceholderHtml(expr, value, context)),
      )
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br>');

  working = working.replace(
    /<image="([^"]+)"(?:\s+scale=([0-9.]+))?\s*\/>/g,
    (_match, assetId: string, scale: string | undefined) => {
      const src = toCdnAssetUrl(assetId);
      const style = scale ? ` style="width:${Number(scale) * 1.25}em;height:${Number(scale) * 1.25}em"` : '';
      return store(
        `<img class="ww__inline-icon" src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(assetId)}"${style}>`,
      );
    },
  );

  working = working.replace(
    /<([@#])([^>]+)>([\s\S]*?)<\/>/g,
    (_match, marker: string, token: string, content: string) => {
      const contentText = stripWikiText(content);
      const renderedContent = contentText.trim().length > 0
        ? renderInlineFragment(contentText)
        : escapeHtml(resolveReferenceLabel(token, context));
      const className = classNameFromToken(token, marker);
      if (!context.semantic) {
        if (marker === '#') {
          const rawItemId = token.startsWith('item.') ? token.slice('item.'.length) : '';
          const packItemId = rawItemId
            ? resolvePackItemId(rawItemId, context.idToPackItemId, context.itemDefsByKeyHash)
            : undefined;
          if (packItemId) {
            return store(
              `<a href="#" data-ww-item-id="${escapeHtmlAttr(packItemId)}">${renderedContent}</a>`,
            );
          }
        }
        return store(renderedContent);
      }
      if (marker === '#') {
        const rawItemId = token.startsWith('item.') ? token.slice('item.'.length) : '';
        const packItemId = rawItemId
          ? resolvePackItemId(rawItemId, context.idToPackItemId, context.itemDefsByKeyHash)
          : undefined;
        if (packItemId) {
          return store(
            `<a href="#" class="ww__inline ${className}" data-ww-item-id="${escapeHtmlAttr(packItemId)}">${renderedContent}</a>`,
          );
        }
      }
      return store(`<span class="ww__inline ${className}">${renderedContent}</span>`);
    },
  );

  working = escapeHtml(preserveBasicHtmlTags(working, store))
    .replace(/\{([^{}]+)\}/g, (_match, expr: string) =>
      store(renderPlaceholderHtml(expr, value, context)),
    )
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>');

  let resolved = working;
  for (let pass = 0; pass <= placeholders.length; pass += 1) {
    const next = resolved.replace(
      /%%WW(\d+)%%/g,
      (_match, index: string) => placeholders[Number(index)] || '',
    );
    if (next === resolved) break;
    resolved = next;
  }
  return resolved;
}

export function formatWikiHtml(value: unknown, context: WarfarinRenderContext = {}): string {
  return renderWarfarinTextHtml(value, context);
}
