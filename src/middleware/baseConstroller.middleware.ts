import { Inject, Injectable, NestMiddleware, HttpException, HttpStatus, Body } from '@nestjs/common';
import { Request, Response } from 'express';
import { BunyanLogger } from '../logger/extlogger.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class BaseControllerMiddleware implements NestMiddleware {
  constructor(
    @Inject('ConfigService') private config: ConfigService,
  ) {}
  use(req: Request, res: Response, next: Function) {
    console.log('--------------------------------------');
    console.log('In middleware');
    console.log('--------------------------------------');
    const resource = req.params.resource;
    const singular = resource.slice(0, resource.length - 1);
    const singularCased = resource.charAt(0).toUpperCase() + singular.slice(1);
    res.locals.resource = resource;
    res.locals.resourceSingular = singular;
    res.locals.resourceSingularCased = singularCased;

    next();
  }
}
