import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BunyanLogger } from './extlogger.service';
import { AppInsightsProvider } from '../telemetry/appinsights.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject('BunyanLogger') private readonly logger: BunyanLogger,
    @Inject('TelemetryProvider') private readonly telem: AppInsightsProvider,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.getArgByIndex(0);
    const res = context.getArgByIndex(1);
    const apiName = `${req.method} ${req.url}`;
    this.logger.Trace('API: ' + apiName);
    this.telem.trackEvent(apiName);

    const now = Date.now();
    return next.handle().pipe(
      tap(() => {
        this.telem.trackMetric(
          this.telem.getMetricTelemetryObject(
            apiName + ' duration',
            Date.now() - now,
          ),
        );

        this.logger.Trace(
          apiName + '  Result: ' + res.statusCode,
          req.get('corr_id'),
        );
      }),
    );
  }
}
