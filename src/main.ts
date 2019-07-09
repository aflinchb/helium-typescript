import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BunyanLogger } from './logger/extlogger.service';

async function bootstrap() {
  const port = process.env.PORT || 3000;
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });
  app.useLogger(app.get(BunyanLogger));
  await app.listen(port);
}
bootstrap();
