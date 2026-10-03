import { useI18n } from "vue-i18n";
import { useAuth } from "../auth/auth-context";
import { getSingleFlightToken } from "../auth/single-flight-token";
import { useToast } from "../components/toast-context";
import { ApiError, ConflictHandledError, toApiError } from "../lib/api-error";
import { apiClient, isCancel, type Method } from "../lib/http-client";

/**
 * callApi の第 2 引数。使わない項目を undefined で埋めずに済むよう、
 * 位置引数ではなくオブジェクトで受ける。
 */
export interface CallApiOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  /** 認証が有効なとき Bearer トークンを付けるか。既定は付ける */
  requiresAuth?: boolean;
}

interface UseApiCallerOptions {
  /** 409 を受けたときに最新データを取り直す。渡すと再同期まで行う */
  onConflict?: () => Promise<void>;
}

export const useApiCaller = (options: UseApiCallerOptions = {}) => {
  const { getToken, isAuthenticated } = useAuth();
  const { showError } = useToast();
  const { t } = useI18n();
  const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

  const callApi = async <T = unknown>(
    path: string,
    { method = "GET", body, signal, requiresAuth = true }: CallApiOptions = {},
  ): Promise<T> => {
    const url = `${import.meta.env.VITE_API_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // 認証が有効かつ要認証のときだけ Bearer トークンを付与する。
    // isAuthenticated は ref なので、呼び出し時点の値を callApi の中で読む。
    // コンポーザブルの先頭で .value を取り出すと、そのコンポーネントが
    // 作られた瞬間の値で固定されてしまう。
    if (authEnabled && requiresAuth && isAuthenticated.value) {
      const token = await getSingleFlightToken(getToken);
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await apiClient.request<T>({
        url,
        method,
        headers,
        data: body,
        signal,
      });
      return response.data;
    } catch (err: unknown) {
      if (isCancel(err)) throw err; // キャンセルはそのまま投げる

      const apiError = toApiError(err);
      if (!apiError) throw err;

      if (apiError.isConflict && options.onConflict) {
        await options.onConflict(); // 最新データ取得
        showError(t("common.error.CONFLICT_RESYNCED"));
        throw new ConflictHandledError(apiError); // 409は処理済みを示す専用エラー
      }
      throw apiError;
    }
  };

  return { callApi };
};

export { ApiError, ConflictHandledError };
