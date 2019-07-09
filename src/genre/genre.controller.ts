import {
  Controller,
  Get,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BunyanLogger } from '../logger/extlogger.service';
import { CosmosDBProvider } from '..//db/cosmos.service';
import { DocumentQuery, RetrievedDocument } from 'documentdb';
import { ConfigService } from '../config/config.service';

@Controller('api/genres')
export class GenreController {
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
  async getAll() {
    let querySpec: DocumentQuery;

    querySpec = {
      parameters: [],
      query: 'SELECT VALUE root.id FROM root where root.type = \'Genre\'',
    };

    let results: RetrievedDocument[];
    try {
      results = await this.db.queryDocuments(
        this.DATABASE_NAME,
        this.COLLECTION_NAME,
        querySpec,
        { enableCrossPartitionQuery: true },
      );
    } catch (err) {
      throw new HttpException('Failed to get all Genres', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return results;
  }
}
