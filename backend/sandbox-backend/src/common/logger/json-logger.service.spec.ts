import { JsonLoggerService } from './json-logger.service';
import { logContextStorage } from './log-context';

/**
 * ロガーの振る舞いを固定する。
 * ここが壊れても画面には何も出ないので、目で見て気づくことができない。
 */
describe('JsonLoggerService', () => {
  let stdout: string[];
  let stderr: string[];
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  const savedServiceName = process.env.OTEL_SERVICE_NAME;

  beforeEach(() => {
    stdout = [];
    stderr = [];
    stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        stdout.push(chunk.toString());
        return true;
      });
    stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        stderr.push(chunk.toString());
        return true;
      });
    delete process.env.OTEL_SERVICE_NAME;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    if (savedServiceName === undefined) delete process.env.OTEL_SERVICE_NAME;
    else process.env.OTEL_SERVICE_NAME = savedServiceName;
  });

  // 1行1JSONで書くので、行をそのままパースできる
  const parse = (lines: string[]): Record<string, unknown>[] =>
    lines.map((line) => {
      expect(line.endsWith('\n')).toBe(true);
      return JSON.parse(line) as Record<string, unknown>;
    });

  describe('レベルフィルタ', () => {
    it('LOG_LEVEL=warn 相当のとき log と debug は出ない', () => {
      const logger = new JsonLoggerService('warn');

      logger.verbose('verbose です');
      logger.debug('debug です');
      logger.log('log です');

      expect(stdout).toEqual([]);
      expect(stderr).toEqual([]);
    });

    it('LOG_LEVEL=warn 相当でも warn 以上は出る', () => {
      const logger = new JsonLoggerService('warn');

      logger.warn('warn です');
      logger.error('error です');
      logger.fatal('fatal です');

      expect(parse(stdout).map((entry) => entry.level)).toEqual(['warn']);
      expect(parse(stderr).map((entry) => entry.level)).toEqual([
        'error',
        'fatal',
      ]);
    });

    it('既定のレベルは error なので warn は落ちる', () => {
      const logger = new JsonLoggerService();

      logger.warn('warn です');
      logger.error('error です');

      expect(stdout).toEqual([]);
      expect(parse(stderr).map((entry) => entry.level)).toEqual(['error']);
    });
  });

  describe('出力先', () => {
    it('error と fatal だけ stderr へ、残りは stdout へ出す', () => {
      const logger = new JsonLoggerService('verbose');

      logger.verbose('a');
      logger.debug('b');
      logger.log('c');
      logger.warn('d');
      logger.error('e');
      logger.fatal('f');

      expect(parse(stdout).map((entry) => entry.level)).toEqual([
        'verbose',
        'debug',
        'log',
        'warn',
      ]);
      expect(parse(stderr).map((entry) => entry.level)).toEqual([
        'error',
        'fatal',
      ]);
    });
  });

  describe('固定フィールド', () => {
    it('timestamp・level・context・message を必ず持つ', () => {
      const logger = new JsonLoggerService('log');

      logger.log('作成しました', 'RaceService');

      const [entry] = parse(stdout);
      expect(Object.keys(entry).sort()).toEqual([
        'context',
        'level',
        'message',
        'timestamp',
      ]);
      expect(entry.level).toBe('log');
      expect(entry.context).toBe('RaceService');
      expect(entry.message).toBe('作成しました');
      // ISO8601（UTC）で出す
      expect(entry.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('context を省くと空文字になる（キー自体は消さない）', () => {
      const logger = new JsonLoggerService('log');

      logger.log('context なし');

      expect(parse(stdout)[0].context).toBe('');
    });
  });

  describe('OTEL_SERVICE_NAME', () => {
    it('設定されていれば serviceName を足す', () => {
      process.env.OTEL_SERVICE_NAME = 'sandbox-backend';
      const logger = new JsonLoggerService('log');

      logger.log('起動しました');

      expect(parse(stdout)[0].serviceName).toBe('sandbox-backend');
    });

    it('設定されていなければ serviceName のキーごと出さない', () => {
      const logger = new JsonLoggerService('log');

      logger.log('起動しました');

      expect(parse(stdout)[0]).not.toHaveProperty('serviceName');
    });

    it('読むのはコンストラクタの時点（あとから変えても効かない）', () => {
      const logger = new JsonLoggerService('log');
      process.env.OTEL_SERVICE_NAME = 'あとから設定';

      logger.log('起動しました');

      expect(parse(stdout)[0]).not.toHaveProperty('serviceName');
    });
  });

  describe('AsyncLocalStorage のコンテキスト', () => {
    it('ストアの中で呼ぶと traceId と sessionId が乗る', () => {
      const logger = new JsonLoggerService('log');

      logContextStorage.run(
        {
          traceId: 'trace-1',
          sessionId: 'session-1',
          userId: 'user-1',
          httpMethod: 'POST',
          httpPath: '/api/races',
          statusCode: 201,
          durationMs: 12,
        },
        () => logger.log('作成しました', 'RaceController'),
      );

      const [entry] = parse(stdout);
      expect(entry).toMatchObject({
        traceId: 'trace-1',
        sessionId: 'session-1',
        userId: 'user-1',
        httpMethod: 'POST',
        httpPath: '/api/races',
        statusCode: 201,
        durationMs: 12,
      });
    });

    it('未設定の任意フィールドはキーごと出さない', () => {
      const logger = new JsonLoggerService('log');

      logContextStorage.run({ traceId: 't', sessionId: 's' }, () =>
        logger.log('最小のコンテキスト'),
      );

      const [entry] = parse(stdout);
      expect(entry.traceId).toBe('t');
      expect(entry).not.toHaveProperty('userId');
      expect(entry).not.toHaveProperty('clientIp');
      expect(entry).not.toHaveProperty('statusCode');
    });

    it('ストアの外で呼ぶと traceId は乗らない', () => {
      const logger = new JsonLoggerService('log');

      logger.log('リクエスト外のログ');

      expect(parse(stdout)[0]).not.toHaveProperty('traceId');
    });
  });

  describe('Error を渡したとき', () => {
    // JSON.stringify(new Error('x')) は {} になる。
    // ここが壊れると起動の失敗が無言のログになるので、目視では気づけない
    it('message と stack を取り出す', () => {
      const logger = new JsonLoggerService('error');
      const error = new Error('接続できません');

      logger.error(error);

      const [entry] = parse(stderr);
      expect(entry.message).toBe('接続できません');
      expect(entry.trace).toBe(error.stack);
      expect(typeof entry.trace).toBe('string');
    });

    it('trace を明示すればそちらを優先する', () => {
      const logger = new JsonLoggerService('error');

      logger.error(new Error('接続できません'), '呼び出し側のスタック');

      expect(parse(stderr)[0].trace).toBe('呼び出し側のスタック');
    });

    it('fatal に Error を渡しても同じように取り出す', () => {
      const logger = new JsonLoggerService('fatal');

      logger.fatal(new Error('起動に失敗しました'));

      const [entry] = parse(stderr);
      expect(entry.message).toBe('起動に失敗しました');
      expect(entry.trace).toEqual(expect.stringContaining('Error'));
    });

    it('文字列を渡したときは trace のキーを出さない', () => {
      const logger = new JsonLoggerService('error');

      logger.error('ただの文字列');

      const [entry] = parse(stderr);
      expect(entry.message).toBe('ただの文字列');
      expect(entry).not.toHaveProperty('trace');
    });
  });
});
