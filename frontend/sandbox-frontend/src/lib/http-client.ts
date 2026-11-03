import axios, { AxiosError, isCancel } from "axios";

/** 内部 API 呼び出し用共通クライアント（タイムアウト: 10 秒） */
export const apiClient = axios.create({ timeout: 10_000 });

/** ストレージからのファイルダウンロード用クライアント（タイムアウト: 60 秒） */
export const storageClient = axios.create({ timeout: 60_000 });

export type { AxiosRequestConfig, GenericAbortSignal, Method } from "axios";
export { AxiosError, isCancel };
