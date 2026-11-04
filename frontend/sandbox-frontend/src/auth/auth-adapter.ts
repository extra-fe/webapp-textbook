import { keycloakAuth } from "./keycloak/keycloak-adapter";
import { mockAuth } from "./mock/mock-auth-adapter";

/**
 * 認証アダプターの選択を1箇所に閉じ込める。
 *
 * バックエンドの ConditionalAuthGuard（1.6節）と同じ考え方で、
 * VITE_AUTH_ENABLED=false のときだけモックに差し替える。素通しではなく
 * アダプターごと差し替えるのが要点で、こうしておけば install が呼ばれない
 * ため Keycloak の init() も走らない。
 */
export const authAdapter =
  import.meta.env.VITE_AUTH_ENABLED === "false" ? mockAuth : keycloakAuth;
