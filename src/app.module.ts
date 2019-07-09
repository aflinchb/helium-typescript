import { Module, CacheModule, CacheInterceptor, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { MovieController } from './movie/movie.controller';
import { ActorController } from './actor/actor.controller';
import { GenreController } from './genre/genre.controller';
import { MovieModule } from './movie/movie.module';
import { ConfigModule } from './config/config.module';
import { SecretModule } from './secrets/secrets.module';
import { LoggingInterceptor } from './logger/logger.interceptor';
import { BaseControllerMiddleware } from './middleware/baseConstroller.middleware';

@Module({
  imports: [MovieModule, ConfigModule, SecretModule, CacheModule.register()],
  controllers: [
    AppController,
    ActorController,
    GenreController,
    MovieController,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
  exports: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BaseControllerMiddleware)
      .forRoutes('api/:resource');
  }
}
