import { Module } from '@nestjs/common';
import { ActorController } from './actor.controller';
import { LoggerModule } from '../logger/logger.module';
import { DbModule } from '../db/db.module';
import { SecretModule } from '../secrets/secrets.module';
import { ConfigModule } from '../config/config.module';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  controllers: [ActorController],
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
export class ActorModule {}
