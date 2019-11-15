import { CosmosClient, Container, SqlQuerySpec, Item, FeedOptions } from "@azure/cosmos";
import { inject, injectable, named } from "inversify";
import { ILoggingProvider } from "../logging/iLoggingProvider";
import { DateUtilities } from "../utilities/dateUtilities";

/**
 * Handles executing queries against CosmosDB
 */
@injectable()
export class CosmosDBProvider {

    private cosmosClient: CosmosClient;
    private databaseId: string;
    private containerId: string;
    private cosmosContainer: Container;

    /**
     * Creates a new instance of the CosmosDB class.
     * @param url The url of the CosmosDB.
     * @param accessKey The CosmosDB access key (primary of secondary).
     * @param logger Logging provider user for tracing/logging.
     */
    constructor(@inject("string") @named("cosmosDbUrl") private url: string,
                @inject("string") @named("cosmosDbKey") accessKey: string,
                @inject("string") @named("database") database: string,
                @inject("string") @named("collection") collection: string,
                @inject("ILoggingProvider") private logger: ILoggingProvider) {

        this.cosmosClient = new CosmosClient({
            endpoint: url,
            key: accessKey,
        });
        this.url = url;
        this.databaseId = database;
        this.containerId = collection;
        this.logger = logger;
    }

    /**
     * Initialize the Cosmos DB Container.
     * This is handled in a separate method to avoid calling async operations in the constructor.
     */
    private async _initialize() {

        this.logger.Trace("Initializing CosmosDB Container");
        this.cosmosContainer = await this.cosmosClient.database(this.databaseId).container(this.containerId);
    }

    /**
     * Runs the given query against CosmosDB.
     * @param query The query to select the documents.
     */
    public async queryDocuments(
        query: SqlQuerySpec,
        options?: FeedOptions): Promise<any[]> {
        if (this.cosmosContainer == null) {
            try {
                await this._initialize();
            } catch (e) {
                this.logger.Trace("No Cosmossetup: " + e);
            }
        }
        // Wrap all functionality in a promise to avoid forcing the caller to use callbacks
        return new Promise(async (resolve, reject) => {
            const { resources: queryResults } = await this.cosmosContainer.items.query(query, options).fetchAll();

            resolve(queryResults);
            reject("Cosmos Error");
        });
    }

    /**
     * Retrieves a specific document by Id.
     * @param partitionKey The partition key for the document.
     * @param documentId The id of the document to query.
     */
    public async getDocument(partitionKey: string,
                             documentId: string): Promise<any> {
        if (this.cosmosContainer == null) {
            try {
                await this._initialize();
            } catch (e) {
                this.logger.Trace("No Cosmossetup: " + e);
            }
        }

        return new Promise(async (resolve, reject) => {
            this.logger.Trace("In CosmosDB getDocument");

            const { resource: result } = await this.cosmosContainer.item(documentId, partitionKey).read();
            resolve(result);
            reject("Cosmos Error");
        });
    }
}
