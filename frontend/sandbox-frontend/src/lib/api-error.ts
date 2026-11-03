import axios from "axios";

export class ApiError extends Error {
  readonly status: number;
  readonly serverMessage: string | undefined;
  readonly code: string | undefined;
  readonly requestId: string | undefined;

  constructor(
    status: number,
    serverMessage: string | undefined,
    code?: string,
    requestId?: string,
  ) {
    super(serverMessage ?? `API error (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.serverMessage = serverMessage;
    this.code = code;
    this.requestId = requestId;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

/** 409 を検知して再同期まで済ませたことを表す。ApiError を apiError に保持するだけ */
export class ConflictHandledError extends Error {
  readonly apiError: ApiError;

  constructor(apiError: ApiError) {
    super("conflict handled");
    this.name = "ConflictHandledError";
    this.apiError = apiError;
  }
}

/** axios のエラーを ApiError に正規化する */
export function toApiError(err: unknown): ApiError | null {
  if (!axios.isAxiosError(err) || !err.response) return null;
  const body = err.response.data as
    | { message?: unknown; code?: unknown; requestId?: unknown }
    | undefined;
  // バリデーションエラーでは message が配列で返ることがある
  const message = Array.isArray(body?.message)
    ? body.message.map(String).join(", ")
    : typeof body?.message === "string"
      ? body.message
      : undefined;
  const code = typeof body?.code === "string" ? body.code : undefined;
  const requestId =
    typeof body?.requestId === "string" ? body.requestId : undefined;
  return new ApiError(err.response.status, message, code, requestId);
}
