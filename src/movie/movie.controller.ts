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
import { KeyVaultProvider } from '../secrets/keyvault.service';
import { CosmosDBProvider } from '..//db/cosmos.service';
import { DocumentQuery, RetrievedDocument } from 'documentdb';
import { ConfigService } from '../config/config.service';
import { Movie } from './models/movie';

const getAllQuery = `SELECT * FROM root where root.type = 'Movie'`;
const getAllFilterQuery = `SELECT * FROM root where CONTAINS(root.textSearch, @title) and root.type = 'Movie'`;
const getByIdQuery = `SELECT * FROM root where root.id = @id and root.type = 'Movie'`;

@Controller('api/movies')
export class MovieController {
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
  async getAll(@Req() request: Request, response: Response) {
    let querySpec: DocumentQuery;

    // Movie name is an optional query param.
    // If not specified, we should query for all movies.
    const movieName: string = request.query.q;
    if (movieName === undefined) {
      querySpec = {
        parameters: [],
        query: getAllQuery,
      };
    } else {
      // Use StartsWith in the title search since the textSearch property always starts with the title.
      // This avoids selecting movies with titles that also appear as Actor names or Genres.
      // Make the movieName lowercase to match the case in the search.
      querySpec = {
        parameters: [
          {
            name: '@title',
            value: movieName.toLowerCase(),
          },
        ],
        query: getAllFilterQuery,
      };
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
      console.log(err);
      throw new HttpException('Failed to get all movies', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return results;
  }

  @Get('/:id')
  public async getById(@Req() request: Request, response: Response) {
    const movieId = request.params.id;

    const querySpec: DocumentQuery = {
      parameters: [
        {
          name: '@id',
          value: movieId,
        },
      ],
      query: getByIdQuery,
    };

    // movieId isn't the partition key, so any search on it will require a cross-partition query.
    let result: RetrievedDocument;
    try {
      result = await this.db.getDocument(this.DATABASE_NAME,
        this.COLLECTION_NAME,
        '0',
        movieId,
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
    const movie: Movie = Object.assign(Object.create(Movie.prototype),
                         JSON.parse(JSON.stringify(pbody)));

    movie.validate().then(async (errors) => {
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
          pbody,
        );
    } catch (err) {
        throw new HttpException('Failed to create object', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return result;
  }

  @Put('/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  public async updateResource(@Req() req, @Body() pbody: any) {
    const movie: Movie = Object.assign(Object.create(Movie.prototype),
                         JSON.parse(JSON.stringify(pbody)));

    movie.id = req.params.id;
    movie.movieId = req.params.id;
    movie.validate().then(async (errors) => {
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
          pbody,
        );
    } catch (err) {
      throw new HttpException('Failed to update resource', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return result;
  }

  @Delete('/:id')
  public async deleteMovieById(@Req() request: Request, @Res() response: Response) {
    const resourceId = request.params.id;

    let result: string;
    try {
        await this.db.deleteDocument(
          this.DATABASE_NAME,
          this.COLLECTION_NAME,
          resourceId,
        );
        result = 'deleted';
    } catch (err) {
        let resCode: number;
        if (err.toString().includes('NotFound')) {
            resCode = HttpStatus.NOT_FOUND;
            result = 'A Movie with that ID does not exist';
        } else {
            resCode = HttpStatus.INTERNAL_SERVER_ERROR;
            result = err.toString();
        }
        throw new HttpException(result, resCode);
    }

    response.status(HttpStatus.NO_CONTENT).json(result);
  }
}
