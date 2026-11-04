import { execSync } from 'node:child_process';
import * as path from 'node:path';

export default function globalSetup(): void {
  // test/ 直下にあるので、パッケージルートは 1 つ上。
  // cwd を明示しないと、呼び出し元のディレクトリ次第で schema を見失う。
  const rootDir = path.resolve(__dirname, '..');
  execSync('npx prisma migrate deploy', { cwd: rootDir, stdio: 'inherit' });
}
