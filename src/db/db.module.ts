import { Module, Global, DynamicModule } from '@nestjs/common';
import { LoggerModule } from '../logger/logger.module';
import { BunyanLogger } from '../logger/extlogger.service';
import { ConfigService } from '../config/config.service';
import { KeyVaultProvider } from '../secrets/keyvault.service';
import { COSMOS_KEYVAULT_KEY } from './constants';
import { CosmosDBProvider } from './cosmos.service';

@Global()
@Module({
  imports: [LoggerModule.forRoot()],
  providers: [],
  exports: [],
})
export class DbModule {
  static forRoot(entities = [], options?): DynamicModule {
    const providers = [
      {
        provide: 'CosmosDBProvider',
        useFactory: async (config: ConfigService, log: BunyanLogger) => {
          const kv = new KeyVaultProvider(log, config);
          const key = await kv.getSecret(COSMOS_KEYVAULT_KEY);
          return new CosmosDBProvider(log, config, key);
        },
        inject: [ConfigService, BunyanLogger],
      },
    ];
    return {
      module: DbModule,
      providers,
      exports: providers,
    };
  }
}
