import { inject, type InjectionKey, type Ref } from "vue";

export interface AuthUser {
  name?: string;
  roles?: string[];
}

export interface IAuthContext {
  isAuthenticated: Ref<boolean>;
  isLoading: Ref<boolean>;
  user: Ref<AuthUser | null>;
  login: () => void;
  logout: () => void;
  getToken: () => Promise<string>;
}

/** provide / inject のキー。型を持たせるため Symbol に InjectionKey を付ける */
export const authKey: InjectionKey<IAuthContext> = Symbol("auth");

export const useAuth = (): IAuthContext => {
  const ctx = inject(authKey);
  if (!ctx) {
    throw new Error("useAuth must be used within an auth adapter provider");
  }
  return ctx;
};
