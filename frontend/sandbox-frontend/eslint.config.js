import pluginVue from "eslint-plugin-vue";
import { withVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";

export default withVueTs(
  { ignores: ["dist"] },
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
);
