import { computed } from "vue";
import { useAuth } from "../auth/auth-context";

export type UserRole = "admin" | "operator" | "viewer";

/** 認証無効時にロールを差し替えるための localStorage のキー */
export const MOCK_ROLES_STORAGE_KEY = "mockUserRoles";

const parseRoles = (raw: string): UserRole[] =>
  raw
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean) as UserRole[];

const readOverride = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(MOCK_ROLES_STORAGE_KEY) ?? null;
  } catch {
    // プライベートモード等で localStorage が触れない場合は環境変数に落とす
    return null;
  }
};

/** localStorage > VITE_MOCK_USER_ROLES > admin の順で解決する */
const resolveMockRoles = (): UserRole[] =>
  parseRoles(readOverride() ?? import.meta.env.VITE_MOCK_USER_ROLES ?? "admin");

export const usePermissions = () => {
  const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";
  const { user } = useAuth();

  // user は ref なので computed で追随させる。ログイン完了でロールが
  // 後から入るケースでも表示制御が正しく切り替わる
  const roles = computed<UserRole[]>(() =>
    authEnabled
      ? ((user.value?.roles as UserRole[]) ?? [])
      : resolveMockRoles(),
  );

  const hasRole = (...required: UserRole[]): boolean =>
    required.some((role) => roles.value.includes(role));

  return { roles, hasRole };
};
