import {
  DocumentClient,
  DocumentQuery,
  FeedOptions,
  RetrievedDocument,
} from 'documentdb';
import { Injectable, Inject } from '@nestjs/common';
import { BunyanLogger } from '../logger/extlogger.service';
import { ConfigService } from '../config/config.service';

/**
 * Handles executing queries against CosmosDB
 */
@Injectable()
export class CosmosDBProvider {
  /**
   * Builds a db link. Generates this over querying CosmosDB for performance reasons.
   * @param database The name of the database the collection is in.
   */
  private static _buildDBLink(database: string): string {
    return `/dbs/${database}`;
  }

  /**
   * Builds a collection link. Generates this over querying CosmosDB for performance reasons.
   * @param database The name of the database the collection is in.
   * @param collection The name of the collection.
   */
  private static _buildCollectionLink(
    database: string,
    collection: string,
  ): string {
    return `/dbs/${database}/colls/${collection}`;
  }

  /**
   * Builds a document link. Generates this over querying CosmosDB for performance reasons.
   * @param database The name of the database the collection is in.
   * @param collection The name of the collection.
   * @param document The id of the document.
   */
  private static _buildDocumentLink(
    database: string,
    collection: string,
    document: string,
  ): string {
    return `/dbs/${database}/colls/${collection}/docs/${document}`;
  }

  private docDbClient: DocumentClient;

  /**
   * Creates a new instance of the CosmosDB class.
   * @param url The url of the CosmosDB.
   * @param accessKey The CosmosDB access key (primary of secondary).
   * @param telem Telemetry provider used for metrics/events.
   * @param logger Logging provider user for tracing/logging.
   */
  constructor(
    @Inject('BunyanLogger') private logger: BunyanLogger,
    @Inject('ConfigService') private config: ConfigService,
    private readonly dbkey: string,
  ) {
    this.docDbClient = new DocumentClient(config.getVarErr('COSMOSDB_URL'), {
      masterKey: dbkey,
    });

    this.logger = logger;
  }

  /**
   * Runs the given query against CosmosDB.
   * @param database The database the document is in.
   * @param collection The collection the document is in.
   * @param query The query to select the documents.
   */
  public async queryDocuments(
    database: string,
    collection: string,
    query: DocumentQuery,
    options?: FeedOptions,
  ): Promise<RetrievedDocument[]> {
    // Wrap all functionality in a promise to avoid forcing the caller to use callbacks
    return new Promise((resolve, reject) => {
      const collectionLink = CosmosDBProvider._buildCollectionLink(
        database,
        collection,
      );

      this.docDbClient
        .queryDocuments(collectionLink, query, options)
        .toArray((err, results, headers) => {
          this.logger.Trace('In CosmosDB queryDocuments');

          // TODO: Figure out how to extract the part of the query after the '?' in the request
          const data = query.toString();

          const resultCode = err == null ? '' : err.code.toString();
          const success = err == null ? true : false;

          if (err == null) {
            resolve(results);
          } else {
            reject(`${err.code}: ${err.body}`);
          }
        });
    });
  }

  /**
   * Delete the given document.
   * @param database The database the document is in.
   * @param collection The collection the document is in.
   * @param document ID of document to be deleted.
   * @param options Optional options, not currently implemented.
   */
  public async deleteDocument(
    database: string,
    collection: string,
    document: string,
    options?: FeedOptions,
  ): Promise<string> {
    // Wrap all functionality in a promise to avoid forcing the caller to use callbacks
    return new Promise((resolve, reject) => {
      const documentLink = CosmosDBProvider._buildDocumentLink(
        database,
        collection,
        document,
      );

      this.docDbClient.deleteDocument(
        documentLink,
        { partitionKey: '0' },
        (err, resource, headers) => {
          // Check for and log the db op RU cost

          if (err) {
            this.logger.Error(Error(err.body), 'Error in deleteDocument');
            reject(`${err.code}: ${err.body}`);
          } else {
            this.logger.Trace('deleteDocument returned success');
            resolve('done');
          }
        },
      );
    });
  }

  /**
   * Runs the given query against CosmosDB.
   * @param database The database the document is in.
   * @param query The query to select the documents.
   */
  public async queryCollections(
    database: string,
    query: DocumentQuery,
  ): Promise<RetrievedDocument[]> {
    // Wrap all functionality in a promise to avoid forcing the caller to use callbacks
    return new Promise((resolve, reject) => {
      const dbLink = CosmosDBProvider._buildDBLink(database);

      this.logger.Trace('In CosmosDB queryCollections');
      this.docDbClient
        .queryCollections(dbLink, query)
        .toArray((err, results, headers) => {
          // Check for and log the db op RU cost

          if (err == null) {
            this.logger.Trace('queryCollections returned success');
            resolve(results);
          } else {
            this.logger.Error(
              Error(err.body),
              'queryCollections returned error'
            );
            reject(`${err.code}: ${err.body}`);
          }
        });
    });
  }

  /**
   * Upserts a document in CosmosDB.
   * @param database The database the document is in.
   * @param collection The collection the document is in.
   * @param content The content of the document to insert.
   */
  public async upsertDocument(
    database: string,
    collection: string,
    content: any,
  ): Promise<RetrievedDocument> {
    // Wrap all functionality in a promise to avoid forcing the caller to use callbacks
    return new Promise((resolve, reject) => {
      this.logger.Trace('In CosmosDB upsertDocument');

      const collectionLink = CosmosDBProvider._buildCollectionLink(
        database,
        collection,
      );
      this.docDbClient.upsertDocument(
        collectionLink,
        content,
        (err, result, headers) => {
          // Track CosmosDB query time metric
          if (err == null) {
            this.logger.Trace('Returning from upsert documents successfully');
            resolve(result);
          } else {
            this.logger.Error(Error(err.body), 'upsertDocument returned error');
            reject(err);
          }
        },
      );
    });
  }

  /**
   * Retrieves a specific document by Id.
   * @param database The database the document is in.
   * @param collection The collection the document is in.
   * @param partitionKey The partition key for the document.
   * @param documentId The id of the document to query.
   */
  public async getDocument(database: string,
                           collection: string,
                           partitionKey: string,
                           documentId: string): Promise<RetrievedDocument> {
    return new Promise((resolve, reject) => {
        this.logger.Trace('In CosmosDB getDocument');
        const documentLink = CosmosDBProvider._buildDocumentLink(database, collection, documentId);

        this.docDbClient.readDocument(documentLink, { partitionKey }, (err, result, headers) => {

            if (err == null) {
                this.logger.Trace('Returning from get document successfully');
                resolve(result);
            } else {
                this.logger.Error(Error(err.body), 'getDocument returned error');
                reject(`${err.code} - ${err.body}`);
            }
        });
    });
  }
}
