import vueI18n from "@intlify/eslint-plugin-vue-i18n";
import pluginVue from "eslint-plugin-vue";
import * as jsoncParser from "jsonc-eslint-parser";
import tseslint from "typescript-eslint";
import { withVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";

export default withVueTs(
  { ignores: ["dist", "scripts", "coverage"] },
  pluginVue.configs["flat/essential"],
  vueTsConfigs.recommendedTypeChecked,
  {
    rules: {
      // リアクティビティを失う書き方を検出する（3.4節）
      "vue/no-ref-object-reactivity-loss": "error",
      "vue/no-setup-props-reactivity-loss": "error",
    },
  },
  {
    rules: {
      // Biome が同等ルールを担うため重複を避ける
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // テストでは ref を作ってその場で .value を読むのが普通なので外す
    files: ["src/test/**"],
    rules: { "vue/no-ref-object-reactivity-loss": "off" },
  },
  { files: ["src/locales/**/*.json"], ...tseslint.configs.disableTypeChecked },
  {
    files: ["src/locales/**/*.json"],
    languageOptions: { parser: jsoncParser },
  },
  {
    files: ["src/**/*.ts", "src/**/*.vue", "src/locales/**/*.json"],
    plugins: { "@intlify/vue-i18n": vueI18n },
    settings: {
      "vue-i18n": {
        localeDir: {
          pattern: "./src/locales/*/*.json",
          localeKey: "path",
          localePattern: ".*/locales/(?<locale>[^/]+)/.*\.json$",
        },
        messageSyntaxVersion: "^11.0.0",
      },
    },
    rules: {
      "@intlify/vue-i18n/no-missing-keys": "error",
      "@intlify/vue-i18n/no-unused-keys": [
        "error",
        { extensions: [".ts", ".vue"] },
      ],
    },
  },
);
