import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  Res,
  Inject,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BunyanLogger } from '../logger/extlogger.service';
import { CosmosDBProvider } from '..//db/cosmos.service';
import { DocumentQuery, RetrievedDocument } from 'documentdb';
import { ConfigService } from '../config/config.service';
import { Actor } from './models/actor';

const getAllQuery = `SELECT * FROM root where root.type = 'Actor'`;
const getAllFilterQuery = `SELECT * FROM root where CONTAINS(root.textSearch, @title) and root.type = 'Actor'`;
const getByIdQuery = `SELECT * FROM root where root.id = @id and root.type = 'Actor'`;

@Controller('api/actors')
export class ActorController {
    DATABASE_NAME: string;
    COLLECTION_NAME: string;
    constructor(
      @Inject('BunyanLogger') private readonly logger: BunyanLogger,
      @Inject('CosmosDBProvider') private readonly db: CosmosDBProvider,
      @Inject('ConfigService') private config: ConfigService,
    ) {
      this.DATABASE_NAME = this.config.getVarErr('DATABASE_NAME');
      this.COLLECTION_NAME = this.config.getVarErr('DATABASE_COLLECTION');
    }

  @Get()
  async getAll(@Req() request: Request, @Res() response: Response) {
    const singularCased = response.locals.resourceSingularCased;
    let querySpec: DocumentQuery = {
      parameters: [
        {
          name: '@type',
          value: singularCased,
        },
      ],
      query: getAllQuery,
    };

    const filterString: string = request.query.q;
    if (filterString !== undefined) {
      querySpec.parameters.push(
        {
          name: '@title',
          value: filterString.toLowerCase(),
        },
      );

      querySpec.query = getAllFilterQuery;
    }

    let results: RetrievedDocument[];
    try {
      results = await this.db.queryDocuments(
        this.DATABASE_NAME,
        this.COLLECTION_NAME,
        querySpec,
        { enableCrossPartitionQuery: true },
      );
    } catch (err) {
      throw new HttpException('Failed to get all Actors', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    response.status(HttpStatus.OK).json(results);
  }

  @Get('/:id')
  public async getById(@Req() request: Request) {
    const actorId = request.params.id;

    const querySpec: DocumentQuery = {
      parameters: [
        {
          name: '@id',
          value: actorId,
        },
      ],
      query: getByIdQuery,
    };

    // actorId isn't the partition key, so any search on it will require a cross-partition query.
    let result: RetrievedDocument;
    try {
      result = await this.db.getDocument(
        this.DATABASE_NAME,
        this.COLLECTION_NAME,
        '0',
        actorId,
      );
    } catch (err) {
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result) {
      throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
    }

    return result;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() pbody: any) {
    const actor: Actor = Object.assign(Object.create(Actor.prototype),
                         JSON.parse(JSON.stringify(pbody)));

    actor.validate().then(async (errors) => {
        if (errors.length > 0) {
            throw new HttpException(
              [].concat.apply([], errors.map((x) => Object.values(x.constraints))),
              HttpStatus.BAD_REQUEST,
            );
        }
    });

    let result: RetrievedDocument;
    try {
        result = await this.db.upsertDocument(
          this.DATABASE_NAME,
          this.COLLECTION_NAME,
          actor,
        );
    } catch (err) {
        throw new HttpException('Failed to create object', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return result;
  }

  @Put('/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  public async updateResource(@Req() req, @Body() pbody: any) {
    const actor: Actor = Object.assign(Object.create(Actor.prototype),
                         JSON.parse(JSON.stringify(pbody)));

    actor.id = req.params.id;
    actor.actorId = req.params.id;

    actor.validate().then(async (errors) => {
        if (errors.length > 0) {
            throw new HttpException(
              [].concat.apply([], errors.map((x) => Object.values(x.constraints))),
              HttpStatus.BAD_REQUEST,
            );
        }
    });

    let result: RetrievedDocument;
    try {
        result = await this.db.upsertDocument(
          this.DATABASE_NAME,
          this.COLLECTION_NAME,
          actor,
        );
    } catch (err) {
      throw new HttpException('Failed to update resource', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return result;
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteActorById(@Req() request: Request, @Res() response: Response) {
    const resourceId = request.params.id;

    let result: string = '';
    try {
        await this.db.deleteDocument(
          this.DATABASE_NAME,
          this.COLLECTION_NAME,
          resourceId,
        );
    } catch (err) {
        let resCode: number;
        if (err.toString().includes('NotFound')) {
            resCode = HttpStatus.NOT_FOUND;
            result = 'An Actor with that ID does not exist';
        } else {
            resCode = HttpStatus.INTERNAL_SERVER_ERROR;
            result = err.toString();
        }
        throw new HttpException(result, resCode);
    }

    return result;
  }
}
