import {
  createI18n,
  type LocaleMessageValue,
  type VueMessageType,
} from "vue-i18n";

type MessageTree = Record<string, LocaleMessageValue<VueMessageType>>;

// ロケールファイルの import は手で並べない。足したときに書き忘れると、
// その名前空間が実行時に丸ごと空表示になる。
const modules = import.meta.glob<MessageTree>("./locales/*/*.json", {
  eager: true,
  import: "default",
});

const messages = Object.entries(modules).reduce<Record<string, MessageTree>>(
  (acc, [path, tree]) => {
    const locale = path.split("/")[2]; // "./locales/ja/race.json" → "ja"
    acc[locale] = { ...acc[locale], ...tree };
    return acc;
  },
  {},
);

export const i18n = createI18n({
  // Composition API（useI18n）で使うため legacy は切る
  legacy: false,
  locale: "ja",
  fallbackLocale: "ja",
  messages,
});

export default i18n;
