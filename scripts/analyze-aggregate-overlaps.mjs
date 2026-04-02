import fs from 'node:fs';

const skland = JSON.parse(fs.readFileSync('public/packs/aef-skland/itemsLite.json', 'utf8'));
const warfarin = JSON.parse(fs.readFileSync('public/packs/warfarin-next/itemsLite.json', 'utf8'));

function hasTag(item, tag) {
  return Array.isArray(item?.tags) && item.tags.includes(tag);
}

function hasAllTags(item, tags) {
  return tags.every((tag) => hasTag(item, tag));
}

function normalizeName(name, mode = 'default') {
  const base = String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (mode !== 'strip-quotes') return base;
  return base.replace(/[“”"'‘’《》〈〉「」『』]/g, '');
}

function groupByName(items, mode = 'default') {
  const grouped = new Map();
  for (const item of items) {
    const nameKey = normalizeName(item?.name, mode);
    if (!nameKey) continue;
    const bucket = grouped.get(nameKey) ?? [];
    bucket.push(item);
    grouped.set(nameKey, bucket);
  }
  return grouped;
}

function uniqueByName(items, mode = 'default') {
  const unique = new Map();
  for (const [nameKey, bucket] of groupByName(items, mode)) {
    if (bucket.length === 1) unique.set(nameKey, bucket[0]);
  }
  return unique;
}

function summarizePair({
  label,
  leftItems,
  rightItems,
  mode = 'default',
  sampleLimit = 20,
}) {
  const left = uniqueByName(leftItems, mode);
  const right = uniqueByName(rightItems, mode);
  let shared = 0;
  const samples = [];

  for (const [nameKey, leftItem] of left) {
    const rightItem = right.get(nameKey);
    if (!rightItem) continue;
    shared += 1;
    if (samples.length < sampleLimit) {
      samples.push({
        nameKey,
        left: {
          id: leftItem.key.id,
          name: leftItem.name,
          tags: leftItem.tags,
        },
        right: {
          id: rightItem.key.id,
          name: rightItem.name,
          tags: rightItem.tags,
        },
      });
    }
  }

  return {
    label,
    mode,
    leftUnique: left.size,
    rightUnique: right.size,
    shared,
    samples,
  };
}

const reports = [
  summarizePair({
    label: 'skland:任务 <-> warfarin:missions/支线任务',
    leftItems: skland.filter((item) => hasTag(item, 'sub:任务')),
    rightItems: warfarin.filter((item) =>
      hasAllTags(item, ['endpoint:missions', 'type:支线任务']),
    ),
  }),
  summarizePair({
    label: 'warfarin:items/蚀刻章 <-> warfarin:medals',
    leftItems: warfarin.filter((item) =>
      hasAllTags(item, ['endpoint:items', 'type:蚀刻章']),
    ),
    rightItems: warfarin.filter((item) => hasTag(item, 'endpoint:medals')),
    mode: 'strip-quotes',
  }),
  summarizePair({
    label: 'skland:活动 <-> warfarin:items/蚀刻章',
    leftItems: skland.filter((item) => hasTag(item, 'sub:活动')),
    rightItems: warfarin.filter((item) =>
      hasAllTags(item, ['endpoint:items', 'type:蚀刻章']),
    ),
    mode: 'strip-quotes',
  }),
  summarizePair({
    label: 'skland:活动 <-> warfarin:medals',
    leftItems: skland.filter((item) => hasTag(item, 'sub:活动')),
    rightItems: warfarin.filter((item) => hasTag(item, 'endpoint:medals')),
    mode: 'strip-quotes',
  }),
];

for (const report of reports) {
  console.log(`\n=== ${report.label} ===`);
  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        leftUnique: report.leftUnique,
        rightUnique: report.rightUnique,
        shared: report.shared,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(report.samples, null, 2));
}
