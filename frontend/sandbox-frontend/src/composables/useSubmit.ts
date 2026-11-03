import { ref } from "vue";

export const useSubmit = <TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<void>,
) => {
  const isSubmitting = ref(false);

  const submit = async (...args: TArgs) => {
    if (isSubmitting.value) return; // 同期チェック：競合状態が起きない
    isSubmitting.value = true;
    try {
      await fn(...args);
    } finally {
      isSubmitting.value = false;
    }
  };

  return { isSubmitting, submit };
};
