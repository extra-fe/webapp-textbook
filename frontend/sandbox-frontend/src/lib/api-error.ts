import axios from "axios";

export class ApiError extends Error {
  readonly status: number;
  readonly serverMessage: string | undefined;

  constructor(status: number, serverMessage: string | undefined) {
    super(serverMessage ?? `API error (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.serverMessage = serverMessage;
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
  const body = err.response.data as { message?: unknown } | undefined;
  const message = typeof body?.message === "string" ? body.message : undefined;
  return new ApiError(err.response.status, message);
}
