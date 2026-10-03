import { onUnmounted, type Ref, watch } from "vue";
import { onBeforeRouteLeave } from "vue-router";

/**
 * 入力途中のまま離脱しようとしたときに引き止める。
 *
 * 離脱には2系統あり、捕まえ方が違う。
 *  - タブ/ウィンドウを閉じる・リロード・別サイトへ移動 → beforeunload
 *    （ブラウザ既定のダイアログ。文言は指定できない）
 *  - アプリ内の画面遷移 → onBeforeRouteLeave（自前のダイアログを出せる）
 *
 * @param isDirty     入力が変更されているか
 * @param confirmLeave アプリ内遷移のときに出す確認。離脱してよければ true を返す
 */
export const useUnsavedChangesGuard = (
  isDirty: Ref<boolean>,
  confirmLeave: () => Promise<boolean>,
) => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    // preventDefault だけでブラウザ既定のダイアログが出る。
    // 昔は戻り値の文字列が表示されたが、現在は文言を指定できない。
    e.preventDefault();
  };

  // 入力がある間だけ登録する。常時登録すると bfcache が効かなくなる
  watch(
    isDirty,
    (dirty) => {
      if (dirty) {
        window.addEventListener("beforeunload", handleBeforeUnload);
      } else {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  });

  onBeforeRouteLeave(async () => {
    if (!isDirty.value) return true;
    return await confirmLeave();
  });
};
