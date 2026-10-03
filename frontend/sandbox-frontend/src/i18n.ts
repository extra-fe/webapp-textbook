import { createI18n } from "vue-i18n";
import commonEn from "./locales/en/common.json";
import errorEn from "./locales/en/error.json";
import maintenanceEn from "./locales/en/maintenance.json";
import raceEn from "./locales/en/race.json";
import commonJa from "./locales/ja/common.json";
import errorJa from "./locales/ja/error.json";
import maintenanceJa from "./locales/ja/maintenance.json";
import raceJa from "./locales/ja/race.json";

/**
 * vue-i18n には i18next の namespace という概念がないため、ロケールごとに
 * 1 つのメッセージツリーへ束ねる。名前空間は JSON 側の第1階層に持たせて
 * あるので、コードに書くキーと JSON 上のキーがそのまま一致する。
 */
const messages = {
  ja: { ...commonJa, ...errorJa, ...maintenanceJa, ...raceJa },
  en: { ...commonEn, ...errorEn, ...maintenanceEn, ...raceEn },
};

export const i18n = createI18n({
  // Composition API（useI18n）で使うため legacy は切る
  legacy: false,
  locale: "ja",
  fallbackLocale: "ja",
  messages,
});

export default i18n;
