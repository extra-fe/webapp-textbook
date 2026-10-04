import { describe, expect, it } from "vitest";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { useConfirmDialog } from "../composables/useConfirmDialog";
import { mountWithApp } from "./helpers";

const defaultProps = {
  isOpen: true,
  title: "確認",
  message: "この操作を実行しますか？",
};

const mountDialog = (props: Record<string, unknown> = {}) =>
  mountWithApp(ConfirmDialog, {
    // フォーカスの検証には実 DOM が必要
    options: { props: { ...defaultProps, ...props }, attachTo: document.body },
  }).wrapper;

/** ボタンを探してフォーカスする。見つからなければ分かりやすく落とす。 */
const focusButton = (w: ReturnType<typeof mountDialog>, text: string) => {
  const el = buttonByText(w, text)?.element;
  if (!el) throw new Error(`ボタンが見つかりません: ${text}`);
  el.focus();
};

const buttonByText = (
  w: ReturnType<typeof mountDialog>,
  text: string | RegExp,
) =>
  w
    .findAll("button")
    .find((b) =>
      typeof text === "string" ? b.text() === text : text.test(b.text()),
    );

describe("ConfirmDialog", () => {
  it("isOpen=false のとき何も描画しない", () => {
    const w = mountDialog({ isOpen: false });
    expect(w.find('[role="dialog"]').exists()).toBe(false);
  });

  it("isOpen=true のときダイアログを表示する", () => {
    const w = mountDialog();
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    expect(w.text()).toContain("確認");
    expect(w.text()).toContain("この操作を実行しますか？");
  });

  it("role/aria-modal/aria-labelledby が付与されている", () => {
    const w = mountDialog();
    const dialog = w.find('[role="dialog"]');
    expect(dialog.attributes("aria-modal")).toBe("true");

    const labelId = dialog.attributes("aria-labelledby");
    expect(labelId).toBeDefined();
    expect(document.getElementById(labelId ?? "")?.textContent).toContain(
      "確認",
    );
  });

  it("「キャンセル」ボタンにデフォルトフォーカスが当たる", () => {
    mountDialog();
    expect(document.activeElement?.textContent?.trim()).toBe("キャンセル");
  });

  it("閉じた状態から開いたときも「キャンセル」にフォーカスが当たる", async () => {
    // 最初から isOpen=true の場合は onMounted がフォーカスを移すため、
    // watch の flush: 'post' はこのケースでしか効かない。既定の watch は DOM 更新前に
    // 走り、v-if の中身がまだ無いので dialog が null になってフォーカスが移らない。
    const w = mountDialog({ isOpen: false });
    expect(document.activeElement?.textContent?.trim()).not.toBe("キャンセル");

    await w.setProps({ isOpen: true });
    expect(document.activeElement?.textContent?.trim()).toBe("キャンセル");
  });

  it("末尾で Tab を押すとフォーカスが先頭へ戻る（フォーカストラップ）", () => {
    const w = mountDialog();
    focusButton(w, "確定");
    expect(document.activeElement?.textContent?.trim()).toBe("確定");

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(document.activeElement?.textContent?.trim()).toBe("キャンセル");
  });

  it("先頭で Shift+Tab を押すとフォーカスが末尾へ回る", () => {
    const w = mountDialog();
    focusButton(w, "キャンセル");

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(document.activeElement?.textContent?.trim()).toBe("確定");
  });

  it("「確定」クリックで confirm が emit される", async () => {
    const w = mountDialog();
    await buttonByText(w, "確定")?.trigger("click");
    expect(w.emitted("confirm")).toHaveLength(1);
  });

  it("「キャンセル」クリックで cancel が emit される", async () => {
    const w = mountDialog();
    await buttonByText(w, "キャンセル")?.trigger("click");
    expect(w.emitted("cancel")).toHaveLength(1);
  });

  it("Escape キーで cancel が emit される", () => {
    const w = mountDialog();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(w.emitted("cancel")).toHaveLength(1);
  });

  it("isLoading=true のとき両ボタンが disabled になる", () => {
    const w = mountDialog({ isLoading: true });
    expect(buttonByText(w, /確定/)?.attributes("disabled")).toBeDefined();
    expect(buttonByText(w, "キャンセル")?.attributes("disabled")).toBeDefined();
  });

  it("confirmLabel / cancelLabel で表示文言を上書きできる", () => {
    const w = mountDialog({ confirmLabel: "削除する", cancelLabel: "やめる" });
    expect(buttonByText(w, "削除する")).toBeDefined();
    expect(buttonByText(w, "やめる")).toBeDefined();
  });
});

describe("useConfirmDialog", () => {
  it("初期状態は isOpen=false", () => {
    expect(useConfirmDialog().isOpen.value).toBe(false);
  });

  it("open() で isOpen が true になる", () => {
    const { isOpen, open } = useConfirmDialog();
    open();
    expect(isOpen.value).toBe(true);
  });

  it("close() で isOpen が false に戻る", () => {
    const { isOpen, open, close } = useConfirmDialog();
    open();
    close();
    expect(isOpen.value).toBe(false);
  });
});
