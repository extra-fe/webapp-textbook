import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * Vitest（Node）用のリクエストインターセプター。
 * ライフサイクル（listen / resetHandlers / close）は src/test/setup.ts で管理する。
 */
export const server = setupServer(...handlers);
