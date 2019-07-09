import { Module, Global, Inject, DynamicModule } from '@nestjs/common';
import { LoggerModule } from '../logger/logger.module';
import { BunyanLogger } from '../logger/extlogger.service';
import { ConfigService } from '../config/config.service';
import { KeyVaultProvider } from '../secrets/keyvault.service';
import { AppInsightsProvider } from './appinsights.service';

@Global()
@Module({
  imports: [],
  providers: [],
  exports: [],
})
export class TelemetryModule {
  static forRoot(entities = [], options?): DynamicModule {
    const providers = [
      {
        provide: 'TelemetryProvider',
        useFactory: async (config: ConfigService, log: BunyanLogger) => {
          const kv = new KeyVaultProvider(log, config);
          const key = await kv.getSecret('AppInsightsInstrumentationKey');
          return new AppInsightsProvider(log, key);
        },
        inject: [ConfigService, BunyanLogger],
      },
    ];
    return {
      module: TelemetryModule,
      providers,
      exports: providers,
    };
  }
}
