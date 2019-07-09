import { Controller, Get, Req, UseInterceptors } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { Request } from 'express';

export const home = {
  message: 'welcome to helium-nestjs!',
  routes: ['/movies', '/movies/:id'],
  version: '0.1.0',
};

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getIndex(@Req() request: Request): any {
    return home;
  }
}
