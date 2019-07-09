import { Module } from '@nestjs/common';
import { MovieController } from './movie.controller';
import { LoggerModule } from '../logger/logger.module';
import { DbModule } from '../db/db.module';
import { SecretModule } from '../secrets/secrets.module';
import { ConfigModule } from '../config/config.module';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  controllers: [MovieController],
  providers: [],
  imports: [
    ConfigModule,
    SecretModule,
    LoggerModule.forRoot(),
    TelemetryModule.forRoot(),
    DbModule.forRoot(),
  ],
  exports: [SecretModule, TelemetryModule.forRoot(), DbModule.forRoot()],
})
export class MovieModule {}
