import { type ComponentMountingOptions, mount } from "@vue/test-utils";
import { type Component, ref } from "vue";
import {
  type AuthUser,
  authKey,
  type IAuthContext,
} from "../auth/auth-context";
import {
  type IToastContext,
  type Toast,
  toastKey,
  toastListKey,
} from "../components/toast-context";
import i18n from "../i18n";

/**
 * IAuthContext の偽実装を作る。
 *
 * vi.mock でモジュールごと差し替えるのではなく、同じキーで provide するだけで
 * 済むのが provide / inject にした利点。IdP を切り替えてもテストは変わらない。
 */
export const makeAuth = (
  overrides: Partial<{
    isAuthenticated: boolean;
    isLoading: boolean;
    user: AuthUser | null;
    login: () => void;
    logout: () => void;
    getToken: () => Promise<string>;
  }> = {},
): IAuthContext => ({
  isAuthenticated: ref(overrides.isAuthenticated ?? false),
  isLoading: ref(overrides.isLoading ?? false),
  user: ref(overrides.user ?? null),
  login: overrides.login ?? (() => {}),
  logout: overrides.logout ?? (() => {}),
  getToken: overrides.getToken ?? (() => Promise.resolve("test-token")),
});

export interface TestToast {
  api: IToastContext;
  items: ReturnType<typeof ref<Toast[]>>;
}

/** 呼ばれた内容を items に溜めるだけのトースト */
export const makeToast = (): TestToast => {
  const items = ref<Toast[]>([]);
  let seq = 0;
  const push = (kind: Toast["kind"], message: string) => {
    items.value = [...items.value, { id: seq++, kind, message }];
  };
  return {
    items,
    api: {
      showError: (message) => push("error", message),
      showSuccess: (message) => push("success", message),
    },
  };
};

export interface MountAppOptions<C extends Component> {
  auth?: IAuthContext;
  toast?: TestToast;
  options?: ComponentMountingOptions<C>;
}

/**
 * i18n・認証・トーストを差し込んでマウントする。
 * 個々のテストで global.plugins / global.provide を書き並べないための薄い包み。
 */
export const mountWithApp = <C extends Component>(
  component: C,
  {
    auth = makeAuth(),
    toast = makeToast(),
    options = {},
  }: MountAppOptions<C> = {},
) => {
  const wrapper = mount(component, {
    ...options,
    global: {
      ...options.global,
      plugins: [i18n, ...(options.global?.plugins ?? [])],
      provide: {
        [authKey as symbol]: auth,
        [toastKey as symbol]: toast.api,
        [toastListKey as symbol]: toast.items,
        ...options.global?.provide,
      },
    },
  });
  return { wrapper, auth, toast };
};
