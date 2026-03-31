import {
  evaluateSearchExpression,
  type SearchExpressionNode,
  type SearchTerm,
} from '../utils/searchExpression';

type SearchableItemEntry = {
  keyHash: string;
  idTermsLower: string[];
  gameIdTermsLower: string[];
  namesLower: string[];
  pinyinFulls: string[];
  pinyinFirsts: string[];
  tagsLower: string[];
};

type WorkerInputMessage =
  | {
      type: 'init';
      items: SearchableItemEntry[];
    }
  | {
      type: 'search';
      requestId: number;
      expression: SearchExpressionNode | null;
    };

type WorkerOutputMessage = {
  type: 'result';
  requestId: number;
  keyHashes: string[];
};

let searchableItems: SearchableItemEntry[] = [];

function normalizePinyinQuery(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function matchesSearchableItem(
  item: SearchableItemEntry,
  searchExpression: SearchExpressionNode | null,
): boolean {
  const matchesTerm = (term: SearchTerm): boolean => {
    switch (term.field) {
      case 'text': {
        if (item.namesLower.some((name) => name.includes(term.value))) return true;
        const query = normalizePinyinQuery(term.value);
        if (query && item.pinyinFulls.some((pinyin) => pinyin.includes(query))) return true;
        if (query && item.pinyinFirsts.some((pinyin) => pinyin.includes(query))) return true;
        if (item.idTermsLower.some((id) => id.includes(term.value))) return true;
        if (item.tagsLower.some((tag) => tag.includes(term.value))) return true;
        return false;
      }
      case 'itemId':
        return item.idTermsLower.some((id) => id.includes(term.value));
      case 'gameId':
        return item.gameIdTermsLower.some((id) => id.includes(term.value));
      case 'tag':
        return item.tagsLower.some((tag) => tag.includes(term.value));
    }
  };

  return evaluateSearchExpression(searchExpression, matchesTerm);
}

self.onmessage = (event: MessageEvent<WorkerInputMessage>) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'init') {
    searchableItems = data.items ?? [];
    return;
  }
  if (data.type !== 'search') return;
  const keyHashes = searchableItems
    .filter((item) => matchesSearchableItem(item, data.expression))
    .map((item) => item.keyHash);
  const out: WorkerOutputMessage = {
    type: 'result',
    requestId: data.requestId,
    keyHashes,
  };
  self.postMessage(out);
};
