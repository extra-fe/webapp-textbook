import { type InjectionKey, inject, type Ref } from "vue";

export interface Toast {
  id: number;
  kind: "success" | "error";
  message: string;
}

export interface IToastContext {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

export const toastKey: InjectionKey<IToastContext> = Symbol("toast");
export const toastListKey: InjectionKey<Ref<Toast[]>> = Symbol("toastList");

export const useToast = (): IToastContext => {
  const ctx = inject(toastKey);
  if (!ctx) throw new Error("useToast must be used within the toast plugin");
  return ctx;
};
