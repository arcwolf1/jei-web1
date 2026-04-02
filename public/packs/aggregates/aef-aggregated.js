function hasTag(item, tag) {
  return Array.isArray(item?.tags) && item.tags.includes(tag);
}

function groupUniqueByName(items) {
  const grouped = new Map();
  for (const item of items) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!name) continue;
    const bucket = grouped.get(name) ?? [];
    bucket.push(item);
    grouped.set(name, bucket);
  }
  return grouped;
}

export default function aggregateAefPack(context) {
  const aliases = {};
  const byPackId = new Map(context.sources.map((entry) => [entry.sourceDef.packId, entry]));

  const aef = byPackId.get('aef');
  const skland = byPackId.get('aef-skland');
  if (!aef || !skland) {
    return { itemAliases: aliases };
  }

  const aefNames = groupUniqueByName(aef.pack.items);
  const sklandCandidates = skland.pack.items.filter((item) => !hasTag(item, 'sub:系统蓝图'));
  const sklandNames = groupUniqueByName(sklandCandidates);

  for (const [name, sklandItems] of sklandNames.entries()) {
    const aefItems = aefNames.get(name) ?? [];
    if (aefItems.length !== 1 || sklandItems.length !== 1) continue;
    context.helpers.setItemAlias(
      aliases,
      'aef-skland',
      sklandItems[0].key.id,
      aefItems[0].key.id,
    );
  }

  return { itemAliases: aliases };
}
