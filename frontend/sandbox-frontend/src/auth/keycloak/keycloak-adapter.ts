import Keycloak from "keycloak-js";
import { type App, ref } from "vue";
import { type AuthUser, authKey, type IAuthContext } from "../auth-context";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

/**
 * Keycloak IdP アダプター（Vue プラグイン）。
 * main.ts の app.use() に渡すことで、アプリ全体が useAuth() を通じて
 * 認証情報にアクセスできる。
 *
 * 別の IdP に切り替える場合は auth/<idp>/<idp>-adapter.ts を作成し、
 * main.ts で app.use() に渡すアダプターを差し替える。
 */
export const keycloakAuth = {
  install(app: App) {
    const isAuthenticated = ref(false);
    // init() が終わるまでは「未認証」と「判定中」の区別が付かない。
    // これを省くと、ページを開いた一瞬だけログイン画面がちらつく。
    const isLoading = ref(true);
    const user = ref<AuthUser | null>(null);

    void keycloak
      .init({
        onLoad: "check-sso",
        // pkceMethod: "S256" は code_challenge の計算に SHA-256 を使う指定。
        // SPA では認可コードを横取りされたときの備えとして必須。
        pkceMethod: "S256",
        // セッション監視用の iframe を使わない。既定（true）だと keycloak-js が
        // login-status-iframe と 3p-cookies チェックを立てるが、サードパーティ
        // クッキーが制限されたブラウザでは iframe からの応答が返らず
        // 「Timeout when waiting for 3rd party check iframe message」で init() が
        // reject し、再認証が延々と繰り返される。
        checkLoginIframe: false,
        // check-sso を隠し iframe の中で行う。これを指定しないと毎回の
        // ページ読み込みで認可エンドポイントへフルリダイレクトし、戻り先の
        // URL に #code=... が付く。
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      })
      .then((authenticated) => {
        isAuthenticated.value = authenticated;
        const parsed = keycloak.tokenParsed;
        user.value = authenticated
          ? {
              name: parsed?.name as string | undefined,
              // Keycloak は既定のロール（default-roles-* / offline_access /
              // uma_authorization）も realm_access.roles に含める。
              roles: parsed?.realm_access?.roles,
            }
          : null;
      })
      .catch((e: unknown) => {
        console.error("Keycloak init failed", e);
      })
      .finally(() => {
        // 初期化が失敗しても画面を固めない
        isLoading.value = false;
      });

    const auth: IAuthContext = {
      isAuthenticated,
      isLoading,
      user,
      login: () => void keycloak.login(),
      logout: () => void keycloak.logout(),
      getToken: async () => {
        // 有効期限が 30 秒以内に迫っていなければ通信しない
        await keycloak.updateToken(30);
        return keycloak.token ?? "";
      },
    };

    app.provide(authKey, auth);
  },
};
