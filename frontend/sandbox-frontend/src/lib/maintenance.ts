const BYPASS_COOKIE = "maintenance_bypass";
const BYPASS_QUERY_PARAM = "maintenance_bypass";

export const isMaintenanceMode = (): boolean =>
  import.meta.env.VITE_MAINTENANCE_MODE === "true";

export const isMaintenanceBypassed = (): boolean => {
  const bypassToken = import.meta.env.VITE_MAINTENANCE_BYPASS_TOKEN;
  // トークンが未設定のときに素通りしないよう、設定済みであることを条件に入れる
  if (!bypassToken || bypassToken.length === 0) return false;

  const params = new URLSearchParams(location.search);
  const queryToken = params.get(BYPASS_QUERY_PARAM);

  // クエリで来たらクッキーへ移し、URL からパラメータを落とす（リロードが走る）
  if (queryToken && queryToken === bypassToken) {
    setBypassCookie(queryToken);
    params.delete(BYPASS_QUERY_PARAM);
    location.replace(
      location.pathname + (params.size > 0 ? `?${params.toString()}` : ""),
    );
    return true;
  }

  return getCookie(BYPASS_COOKIE) === bypassToken;
};

function setBypassCookie(token: string): void {
  // SameSite=Strict で CSRF 経由の悪用を防ぐ。
  // HttpOnly はクライアント側の判定に JS が必要なため設定できない。
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${BYPASS_COOKIE}=${token}; SameSite=Strict; Path=/${secure}`;
}

function getCookie(name: string): string | null {
  const found = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return found ? (found.split("=")[1] ?? null) : null;
}
