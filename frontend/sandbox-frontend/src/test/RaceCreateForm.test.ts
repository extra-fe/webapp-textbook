import { describe, expect, it, vi } from "vitest";
import type { CreateRaceFormValues } from "../../../../shared/src/race-validation";
import RaceCreateForm from "../pages/RaceCreateForm.vue";
import { mountWithApp } from "./helpers";

const mountForm = (
  onSubmit: (values: CreateRaceFormValues) => Promise<void> = () =>
    Promise.resolve(),
) =>
  mountWithApp(RaceCreateForm, {
    options: { props: { onSubmit }, attachTo: document.body },
  }).wrapper;

const fill = async (wrapper: ReturnType<typeof mountForm>) => {
  await wrapper.find('input[type="date"]').setValue("1993-11-14");
  await wrapper.find("#name").setValue("有馬記念");
  await wrapper.find("#venue").setValue("中山");
};

const confirmButton = (wrapper: ReturnType<typeof mountForm>) =>
  wrapper.findAll("button").find((b) => b.text() === "確定");

describe("RaceCreateForm", () => {
  it("空のまま送信すると全フィールドにエラーが出て、確認ダイアログも開かない", async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    const wrapper = mountForm(onSubmit);

    await wrapper.find("form").trigger("submit");

    // vee-validate の検証は非同期。flushPromises では足りないので waitFor で待つ
    await vi.waitFor(() => {
      expect(wrapper.findAll("p").map((p) => p.text())).toEqual([
        "YYYY-MM-DD 形式で入力してください",
        "必須項目です",
        "必須項目です",
      ]);
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("検証を通ると確認ダイアログが開き、そこで初めて送信する", async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    const wrapper = mountForm(onSubmit);

    await fill(wrapper);
    await wrapper.find("form").trigger("submit");

    await vi.waitFor(() => {
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    });
    // ダイアログを開いただけでは送らない
    expect(onSubmit).not.toHaveBeenCalled();

    await confirmButton(wrapper)?.trigger("click");
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith({
      date: "1993-11-14",
      name: "有馬記念",
      venue: "中山",
    });
  });

  it("「確定」を連打しても送信は 1 回だけ", async () => {
    // release() を呼ぶまで解決しない Promise を返す。すぐ解決するモックだと
    // 1 回目が終わってから 2 回目が来るため、isSubmitting が false に戻っていて
    // ガードを試せない。送信中のまま次のクリックを入れるのが肝。
    let release: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const wrapper = mountForm(onSubmit);

    await fill(wrapper);
    await wrapper.find("form").trigger("submit");
    await vi.waitFor(() => {
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    });

    // disabled が DOM に反映される前に届く 2 回目・3 回目を再現するため、
    // trigger を await せずに続けて発火する（await すると間に描画が入る）。
    const confirm = confirmButton(wrapper);
    if (!confirm) throw new Error("「確定」ボタンが見つかりません");
    confirm.element.dispatchEvent(new MouseEvent("click"));
    confirm.element.dispatchEvent(new MouseEvent("click"));
    confirm.element.dispatchEvent(new MouseEvent("click"));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    release();
  });
});
