import { useAuth } from "../auth/auth-context";
import { apiClient, type Method } from "../lib/http-client";

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

export const useApiCaller = () => {
  const { getToken, isAuthenticated } = useAuth();
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
      headers.Authorization = `Bearer ${await getToken()}`;
    }

    const response = await apiClient.request<T>({
      url,
      method,
      headers,
      data: body,
      signal,
    });
    return response.data;
  };

  return { callApi };
};
