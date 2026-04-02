export function getWarfarinProfessionLabel(
  professionId: unknown,
  fallback: unknown,
  locale = 'en-US',
): string {
  const raw = typeof fallback === 'string' ? fallback.trim() : '';
  const n = typeof professionId === 'number' ? professionId : Number(professionId);
  const zhCN: Record<number, string> = {
    0: '近卫',
    1: '狙击',
    2: '重装',
    3: '医疗',
    4: '辅助',
    5: '术师',
    6: '特种',
    7: '先锋',
    8: '突击',
  };
  const enUS: Record<number, string> = {
    0: 'Guard',
    1: 'Sniper',
    2: 'Defender',
    3: 'Medic',
    4: 'Supporter',
    5: 'Caster',
    6: 'Specialist',
    7: 'Vanguard',
    8: 'Assault',
  };
  const jaJP: Record<number, string> = {
    0: '前衛',
    1: '狙撃',
    2: '重装',
    3: '医療',
    4: '補助',
    5: '術師',
    6: '特殊',
    7: '先鋒',
    8: '強襲',
  };
  if (Number.isFinite(n)) {
    if (locale.startsWith('zh')) return zhCN[n] || raw || '-';
    if (locale.startsWith('ja')) return jaJP[n] || raw || '-';
    return enUS[n] || raw || '-';
  }
  return raw || '-';
}

export function getWarfarinWeaponTypeLabel(weaponType: unknown, locale = 'en-US'): string {
  const n = typeof weaponType === 'number' ? weaponType : Number(weaponType);
  const zhCN: Record<number, string> = {
    0: '无',
    1: '单手剑',
    2: '法杖',
    3: '大剑',
    4: '枪械',
    5: '长枪',
    6: '手枪',
  };
  const enUS: Record<number, string> = {
    0: 'None',
    1: 'Sword',
    2: 'Wand',
    3: 'Claymore',
    4: 'Gun',
    5: 'Lance',
    6: 'Pistol',
  };
  const jaJP: Record<number, string> = {
    0: 'なし',
    1: '片手剣',
    2: '杖',
    3: '大剣',
    4: '銃',
    5: '長槍',
    6: '拳銃',
  };
  if (!Number.isFinite(n)) return '-';
  if (locale.startsWith('zh')) return zhCN[n] || `Unknown(${n})`;
  if (locale.startsWith('ja')) return jaJP[n] || `Unknown(${n})`;
  return enUS[n] || `Unknown(${n})`;
}

export function getWarfarinDamageTypeLabel(type: unknown, locale = 'en-US'): string {
  const key = typeof type === 'string' ? type.trim() : '';
  const labels: Record<string, { zh: string; en: string; ja: string }> = {
    Physical: { zh: '物理', en: 'Physical', ja: '物理' },
    Fire: { zh: '灼热', en: 'Fire', ja: '炎熱' },
    Pulse: { zh: '电磁', en: 'Pulse', ja: '電磁' },
    Cryst: { zh: '寒冷', en: 'Cryst', ja: '寒冷' },
    Natural: { zh: '自然', en: 'Natural', ja: '自然' },
    Ether: { zh: '超域', en: 'Ether', ja: 'エーテル' },
    Default: { zh: '默认', en: 'Default', ja: 'デフォルト' },
    Trial: { zh: '试用', en: 'Trial', ja: '試用' },
  };
  if (!key) return '-';
  const label = labels[key];
  if (!label) return key;
  if (locale.startsWith('zh')) return label.zh;
  if (locale.startsWith('ja')) return label.ja;
  return label.en;
}
