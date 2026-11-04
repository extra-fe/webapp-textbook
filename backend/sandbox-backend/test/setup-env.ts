// PrismaService はコンストラクタで DATABASE_URL を読むため、
// テストファイルの import より前に .env を読み込む必要がある。
import 'dotenv/config';

// ConditionalAuthGuard が MockAuthGuard に切り替わる（上巻 1.6節）
process.env.AUTH_ENABLED = 'false';
// クエリログはテスト出力を埋めるので黙らせる。
// 空文字ではなく delete する。PrismaService は split(',') した結果をそのまま
// ログレベルに使うため、'' だと [''] になって PrismaClient が弾く。
delete process.env.PRISMA_LOG_LEVEL;
process.env.NODE_ENV = 'test';
