/**
 * ISO8601 の日時文字列を日付として整形する。
 *
 * timeZone: "UTC" が要点。これを省くとブラウザのローカルTZで解釈され、
 * UTC 0:00 に保存した値が UTC より西のTZでは前日になる。
 * ロケール（第1引数）は undefined のままにしてブラウザの言語設定に従わせる。
 * 変えてはいけないのはタイムゾーンだけで、表記の好みは利用者に合わせてよい。
 */
export function formatDate(isoString: string | undefined): string {
  if (!isoString) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(isoString));
}
