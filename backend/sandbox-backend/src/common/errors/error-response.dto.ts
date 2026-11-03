import type { ErrorCode } from './error-code.enum';

export interface ErrorResponseBody {
  statusCode: number; // HTTPステータスコード
  code: ErrorCode; // 機械判別用エラーコード
  message: string; // 人間向けメッセージ
  requestId: string; // リクエスト追跡用ID（ログと紐付け可能）
  timestamp: string; // エラー発生日時（ISO 8601）
}

/** 2つのフィルターで共用する組み立て関数 */
export function buildErrorResponse(
  statusCode: number,
  code: ErrorCode,
  message: string,
  requestId: string,
  now: () => Date,
): ErrorResponseBody {
  return {
    statusCode,
    code,
    message,
    requestId,
    timestamp: now().toISOString(),
  };
}
