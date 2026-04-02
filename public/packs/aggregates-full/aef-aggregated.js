function hasTag(item, tag) {
  return Array.isArray(item?.tags) && item.tags.includes(tag);
}

function hasAllTags(item, tags) {
  return tags.every((tag) => hasTag(item, tag));
}

function normalizeDefaultName(context, name) {
  return context.helpers.normalizeItemName(name ?? '');
}

function normalizeLooseQuotedName(context, name) {
  return normalizeDefaultName(context, name).replace(/[“”"'‘’《》〈〉「」『』]/g, '');
}

function getItemRarityKey(item) {
  const tag = Array.isArray(item?.tags)
    ? item.tags.find((entry) => typeof entry === 'string' && entry.startsWith('rarity:'))
    : undefined;
  if (tag) return tag.slice('rarity:'.length).trim();
  const stars = item?.rarity?.stars;
  if (typeof stars === 'number' && Number.isFinite(stars)) return String(stars);
  return '';
}

function normalizeLooseQuotedNameWithRarity(context, name, item) {
  const base = normalizeLooseQuotedName(context, name);
  const rarity = getItemRarityKey(item);
  return `${base}\u0000${rarity}`;
}

function getNameKey(context, item, normalizeName = normalizeDefaultName) {
  return normalizeName(context, item?.name ?? '', item);
}

function groupByName(context, items, normalizeName = normalizeDefaultName) {
  const grouped = new Map();
  for (const item of items) {
    const nameKey = getNameKey(context, item, normalizeName);
    if (!nameKey) continue;
    const bucket = grouped.get(nameKey) ?? [];
    bucket.push(item);
    grouped.set(nameKey, bucket);
  }
  return grouped;
}

function buildUniqueByName(context, items, normalizeName = normalizeDefaultName) {
  const unique = new Map();
  const grouped = groupByName(context, items, normalizeName);
  grouped.forEach((bucket, nameKey) => {
    if (bucket.length === 1) {
      unique.set(nameKey, bucket[0]);
    }
  });
  return unique;
}

function getWarfarinMeta(item) {
  return item?.extensions?.jeiweb?.meta ?? {};
}

function isWarfarinNopVariant(item) {
  const meta = getWarfarinMeta(item);
  const slug = String(meta.slug ?? meta.itemId ?? item?.key?.id ?? '');
  return slug.includes('_nop_');
}

function resolveAliasableBucket(bucket, resolver) {
  if (!Array.isArray(bucket) || bucket.length === 0) return null;
  if (resolver === 'all') {
    return {
      representative: bucket[0],
      aliasItems: bucket,
    };
  }
  if (bucket.length === 1) {
    return {
      representative: bucket[0],
      aliasItems: bucket,
    };
  }
  if (resolver === 'prefer-non-nop') {
    const preferred = bucket.filter((item) => !isWarfarinNopVariant(item));
    if (preferred.length === 1) {
      return {
        representative: preferred[0],
        aliasItems: bucket,
      };
    }
  }
  return null;
}

function buildAliasableByName(
  context,
  items,
  resolver = 'unique',
  normalizeName = normalizeDefaultName,
) {
  const aliasable = new Map();
  const grouped = groupByName(context, items, normalizeName);
  grouped.forEach((bucket, nameKey) => {
    const resolved = resolveAliasableBucket(bucket, resolver);
    if (resolved) {
      aliasable.set(nameKey, resolved);
    }
  });
  return aliasable;
}

function filterByTags(items, tags) {
  return items.filter((item) => hasAllTags(item, tags));
}

function getExistingAlias(aliases, sourcePackId, sourceItemId) {
  return aliases?.[sourcePackId]?.[sourceItemId];
}

function setAliasesForItems(context, aliases, sourcePackId, items, canonicalItemId) {
  for (const item of items) {
    context.helpers.setItemAlias(aliases, sourcePackId, item.key.id, canonicalItemId);
  }
}

function applyAefSklandAliases(context, aliases, aef, skland) {
  const aefNames = buildUniqueByName(context, aef.pack.items);
  const sklandCandidates = skland.pack.items.filter((item) => !hasTag(item, 'sub:系统蓝图'));
  const sklandNames = buildUniqueByName(context, sklandCandidates);

  sklandNames.forEach((sklandItem, nameKey) => {
    const aefItem = aefNames.get(nameKey);
    if (!aefItem) return;
    context.helpers.setItemAlias(
      aliases,
      'aef-skland',
      sklandItem.key.id,
      aefItem.key.id,
    );
  });
}

function applyWarfarinRule(context, aliases, skland, warfarin, rule) {
  const normalizeName = rule.normalizeName ?? normalizeDefaultName;
  const sklandItems = skland.pack.items.filter((item) => hasTag(item, rule.sklandTag));
  const sklandByName = buildUniqueByName(context, sklandItems, normalizeName);
  const primaryByName = buildAliasableByName(
    context,
    filterByTags(warfarin.pack.items, rule.primaryTags),
    rule.primaryResolver ?? 'unique',
    normalizeName,
  );
  const secondaryByName = (rule.secondaryTagsList ?? []).map((tags) =>
    buildAliasableByName(context, filterByTags(warfarin.pack.items, tags), 'unique', normalizeName),
  );

  primaryByName.forEach((primaryBucket, nameKey) => {
    const sklandItem = sklandByName.get(nameKey);
    const canonicalItemId =
      (sklandItem && getExistingAlias(aliases, 'aef-skland', sklandItem.key.id)) ??
      sklandItem?.key.id ??
      primaryBucket.representative.key.id;

    setAliasesForItems(
      context,
      aliases,
      'warfarin-next',
      primaryBucket.aliasItems,
      canonicalItemId,
    );

    secondaryByName.forEach((byName) => {
      const bucket = byName.get(nameKey);
      if (!bucket) return;
      setAliasesForItems(context, aliases, 'warfarin-next', bucket.aliasItems, canonicalItemId);
    });
  });
}

function applyWarfarinInternalRule(context, aliases, warfarin, rule) {
  const normalizeName = rule.normalizeName ?? normalizeDefaultName;
  const primaryByName = buildAliasableByName(
    context,
    filterByTags(warfarin.pack.items, rule.primaryTags),
    rule.primaryResolver ?? 'unique',
    normalizeName,
  );
  const secondaryByName = (rule.secondaryTagsList ?? []).map((tags) =>
    buildAliasableByName(context, filterByTags(warfarin.pack.items, tags), 'unique', normalizeName),
  );

  primaryByName.forEach((primaryBucket, nameKey) => {
    const canonicalItemId = primaryBucket.representative.key.id;
    setAliasesForItems(
      context,
      aliases,
      'warfarin-next',
      primaryBucket.aliasItems,
      canonicalItemId,
    );
    secondaryByName.forEach((byName) => {
      const bucket = byName.get(nameKey);
      if (!bucket) return;
      setAliasesForItems(context, aliases, 'warfarin-next', bucket.aliasItems, canonicalItemId);
    });
  });
}

export default function aggregateAefFullPack(context) {
  const aliases = {};
  const byPackId = new Map(context.sources.map((entry) => [entry.sourceDef.packId, entry]));

  const aef = byPackId.get('aef');
  const skland = byPackId.get('aef-skland');
  const warfarin = byPackId.get('warfarin-next');
  if (!aef || !skland) {
    return { itemAliases: aliases };
  }

  applyAefSklandAliases(context, aliases, aef, skland);

  if (!warfarin) {
    return { itemAliases: aliases };
  }

  const rules = [
    {
      sklandTag: 'sub:物品',
      primaryTags: ['endpoint:items', 'type:材料'],
    },
    {
      sklandTag: 'sub:装备',
      primaryTags: ['endpoint:gear'],
      secondaryTagsList: [['endpoint:items', 'type:装备']],
    },
    {
      sklandTag: 'sub:武器',
      primaryTags: ['endpoint:weapons'],
      secondaryTagsList: [['endpoint:items', 'type:武器']],
    },
    {
      sklandTag: 'sub:设备',
      primaryTags: ['endpoint:facilities'],
      primaryResolver: 'prefer-non-nop',
      secondaryTagsList: [
        ['endpoint:items', 'type:普通设备'],
        ['endpoint:items', 'type:功能设备'],
        ['endpoint:items', 'type:物流'],
      ],
    },
    {
      sklandTag: 'sub:威胁',
      primaryTags: ['endpoint:enemies'],
    },
    {
      sklandTag: 'sub:干员',
      primaryTags: ['endpoint:operators'],
    },
    {
      sklandTag: 'sub:系统蓝图',
      primaryTags: ['endpoint:items', 'type:系统蓝图'],
    },
    {
      sklandTag: 'sub:任务',
      primaryTags: ['endpoint:missions'],
      primaryResolver: 'all',
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:任务物品'],
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:武器基质',
      primaryTags: ['endpoint:items', 'type:基质'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:干员信物'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:礼物'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:限时珍贵物品'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:物资箱'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:培养基核'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:沉积具象物'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:理智药剂'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:珍贵物品'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:珍贵培养素材'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:帝江号陈列品'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:沉积结核'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:干员培养素材'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:贵重品库',
      primaryTags: ['endpoint:items', 'type:探测器'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:物品',
      primaryTags: ['endpoint:items', 'type:战术物品'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
    {
      sklandTag: 'sub:物品',
      primaryTags: ['endpoint:items', 'type:消耗品'],
      primaryResolver: 'all',
      normalizeName: normalizeLooseQuotedNameWithRarity,
    },
  ];

  for (const rule of rules) {
    applyWarfarinRule(context, aliases, skland, warfarin, rule);
  }

  const internalWarfarinRules = [
    {
      primaryTags: ['endpoint:items', 'type:蚀刻章'],
      secondaryTagsList: [['endpoint:medals']],
      normalizeName: normalizeLooseQuotedName,
    },
  ];

  for (const rule of internalWarfarinRules) {
    applyWarfarinInternalRule(context, aliases, warfarin, rule);
  }

  return { itemAliases: aliases };
}
