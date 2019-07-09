import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { Request } from 'express';
import { ConfigService } from './config/config.service';
import { home } from './app.controller';

describe('AppController', () => {
  let app: AppController;
  let config: ConfigService;
  let req: Request;

  beforeAll(async () => {
    config = new ConfigService();
    app = new AppController(config);
  });

  describe('getIndex', () => {
      it('should return "Hello World!"', async () => {
        expect(await app.getIndex(req)).toBe(home);
      });
  });
});
