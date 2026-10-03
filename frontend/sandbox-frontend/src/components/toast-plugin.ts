import { type App, ref } from "vue";
import { type Toast, toastKey, toastListKey } from "./toast-context";

export const toastPlugin = {
  install(app: App) {
    const toasts = ref<Toast[]>([]);
    let nextId = 0;

    const push = (kind: Toast["kind"], message: string) => {
      const id = nextId++;
      toasts.value = [...toasts.value, { id, kind, message }];
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
      }, 5000);
    };

    app.provide(toastKey, {
      showSuccess: (message: string) => {
        push("success", message);
      },
      showError: (message: string) => {
        push("error", message);
      },
    });
    app.provide(toastListKey, toasts);
  },
};
