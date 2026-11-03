/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KEYCLOAK_URL: string;
  readonly VITE_KEYCLOAK_REALM: string;
  readonly VITE_KEYCLOAK_CLIENT_ID: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AUTH_ENABLED: string;
  readonly VITE_MOCK_USER_ROLES: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
