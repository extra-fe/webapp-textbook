import { Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ExternalHttpClient } from './external-http.client';

@Module({
  providers: [CircuitBreakerService, ExternalHttpClient],
  exports: [CircuitBreakerService, ExternalHttpClient],
})
export class HttpClientModule {}
