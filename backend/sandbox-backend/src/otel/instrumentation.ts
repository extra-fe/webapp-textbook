import 'dotenv/config';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

process.env.OTEL_LOG_LEVEL = process.env.OTEL_LOG_LEVEL ?? 'NONE';

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'sandbox-backend',
  traceExporter: new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // ファイルI/Oまで追跡すると大量のスパンが出るので無効化する
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
  autoDetectResources: false,
});

sdk.start();
