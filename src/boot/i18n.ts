import { defineBoot } from '#q-app/wrappers';
import { createI18n } from 'vue-i18n';
import { storage } from 'src/utils/storage';

import messages from 'src/i18n';

export type MessageLanguages = keyof typeof messages;
type LocaleSchema<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends ReadonlyArray<unknown>
      ? string[]
      : T[K] extends Record<string, unknown>
        ? LocaleSchema<T[K]>
        : string;
};
export type MessageSchema = LocaleSchema<(typeof messages)['en-US']>;

// See https://vue-i18n.intlify.dev/guide/advanced/typescript.html#global-resource-schema-type-definition
/* eslint-disable @typescript-eslint/no-empty-object-type */
declare module 'vue-i18n' {
  // define the locale messages schema
  export interface DefineLocaleMessage extends MessageSchema {}

  // define the datetime format schema
  export interface DefineDateTimeFormat {}

  // define the number format schema
  export interface DefineNumberFormat {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type */

export default defineBoot(async ({ app }) => {
  // 探测浏览器语言
  const browserLang = navigator.language;
  const detectedLocale: MessageLanguages = browserLang.startsWith('zh')
    ? 'zh-CN'
    : browserLang.startsWith('ja')
      ? 'ja-JP'
      : 'en-US';

  // 从存储读取语言设置（支持 JEIStorage 和 localStorage）
  let initialLocale: MessageLanguages = detectedLocale;
  try {
    const raw = await storage.getItem('jei.settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.language === 'zh-CN' || parsed.language === 'en-US' || parsed.language === 'ja-JP') {
        initialLocale = parsed.language;
      }
    }
  } catch {
    // 忽略错误，使用默认值
  }

  const i18n = createI18n<{ message: MessageSchema }, MessageLanguages>({
    locale: initialLocale,
    legacy: false,
    messages,
  });

  // Set i18n instance on app
  app.use(i18n);
});
