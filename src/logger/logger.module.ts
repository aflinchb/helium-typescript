import { Module, Global, DynamicModule } from '@nestjs/common';
import { BunyanLogger } from './extlogger.service';

@Global()
@Module({
  controllers: [],
  providers: [BunyanLogger],
  exports: [BunyanLogger],
})
export class LoggerModule {
  static forRoot(entities = [], options?): DynamicModule {
    const providers = [
      {
        provide: 'LOGGER_NAME',
        useValue: {
          name: 'helium.bunyan',
        },
      },
    ];
    return {
      module: LoggerModule,
      providers,
      exports: providers,
    };
  }
}
