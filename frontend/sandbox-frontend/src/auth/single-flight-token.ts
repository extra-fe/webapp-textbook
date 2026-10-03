// モジュールスコープなので、このモジュールを読み込むすべての箇所で共有される
let refreshPromise: Promise<string> | null = null;

export const getSingleFlightToken = (
  getToken: () => Promise<string>,
): Promise<string> => {
  if (refreshPromise) return refreshPromise; // 進行中なら同じPromiseを返す
  refreshPromise = getToken().finally(() => {
    refreshPromise = null; // 完了後にクリア
  });
  return refreshPromise;
};

/** テスト用。進行中の Promise を捨てる。 */
export const resetSingleFlightToken = () => {
  refreshPromise = null;
};
