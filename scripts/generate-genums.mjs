/**
 * 从 temp/GEnums/*.cs 自动生成 TypeScript 枚举映射文件
 * 输出到 src/components/wiki/warfarin/genums.ts
 *
 * 用法: node scripts/generate-genums.mjs
 *
 * 只提取渲染器实际使用的枚举类型。
 * 如需新增，在下方 ENUM_CONFIG 添加即可。
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const genumsDir = join(root, 'temp', 'GEnums');
const outFile = join(root, 'src', 'components', 'wiki', 'warfarin', 'genums.ts');

// ---- 配置：需要提取哪些枚举 ----
// key = .cs 文件名（不含 .cs）, value = 导出的 TS 名
const ENUM_CONFIG = [
  'AttributeType',
  'ProfessionCategory',
  'WeaponType',
  'DisplayEnemyType',
  'FacBuildingType',
  'MissionType',
  'ItemType',
  'ItemShowingType',
  'ElementalType',
  'PartType',
  'ModifierType',
  'CharDocUnlockType',
  'DamageType',
  'SkillType',
  'SkillGroupType',
  'CharType',
];

/** 从 C# 枚举文件解析出 { name, value } 列表 */
function parseCsEnum(filePath) {
  const src = readFileSync(filePath, 'utf-8');
  const entries = [];
  // 匹配  Name = 123  或  Name = 0x1F
  const re = /^\s+(\w+)\s*=\s*(-?\d+|0x[\da-fA-F]+)/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const value = m[2].startsWith('0x') ? parseInt(m[2], 16) : parseInt(m[2], 10);
    entries.push({ name, value });
  }
  return entries;
}

// ---- 主流程 ----
const available = new Set(readdirSync(genumsDir).filter(f => f.endsWith('.cs')).map(f => f.replace('.cs', '')));

const blocks = [];
const lookupExports = [];

for (const enumName of ENUM_CONFIG) {
  if (!available.has(enumName)) {
    console.warn(`⚠ ${enumName}.cs not found in ${genumsDir}, skipped`);
    continue;
  }
  const entries = parseCsEnum(join(genumsDir, `${enumName}.cs`));
  if (entries.length === 0) {
    console.warn(`⚠ ${enumName}.cs has no entries, skipped`);
    continue;
  }

  // 生成 const enum
  const enumLines = entries.map(e => `  ${e.name} = ${e.value},`);
  blocks.push(`export const enum ${enumName} {\n${enumLines.join('\n')}\n}`);

  // 生成 lookup map: number → string
  const mapName = `${enumName[0].toLowerCase()}${enumName.slice(1)}Names`;
  const mapLines = entries.map(e => `  [${e.value}]: '${e.name}',`);
  blocks.push(
    `export const ${mapName}: Record<number, string> = {\n${mapLines.join('\n')}\n};`,
  );

  lookupExports.push(mapName);
}

// 通用查找函数
blocks.push(`
/**
 * 通用枚举值 → 名称查找。
 * 传入对应的 names map 和数字 ID，返回枚举名或 fallback。
 */
export function resolveEnumName(
  map: Record<number, string>,
  id: unknown,
  fallback?: string,
): string {
  const n = typeof id === 'number' ? id : typeof id === 'string' ? Number(id) : NaN;
  if (Number.isFinite(n) && n in map) return map[n]!;
  return fallback ?? (Number.isFinite(n) ? \`Unknown(\${n})\` : '-');
}`);

const header = [
  '/**',
  ' * 自动生成 — 请勿手动编辑',
  ' * 来源: temp/GEnums/*.cs (Il2CppInspector)',
  ` * 生成时间: ${new Date().toISOString()}`,
  ` * 生成脚本: scripts/generate-genums.mjs`,
  ' */',
  '',
].join('\n');

writeFileSync(outFile, header + blocks.join('\n\n') + '\n', 'utf-8');

console.log(`✓ Generated ${outFile}`);
console.log(`  ${ENUM_CONFIG.length} enums requested, ${lookupExports.length} generated`);
console.log(`  Exports: ${lookupExports.join(', ')}`);
