import { DocumentClient, DocumentQuery, FeedOptions, RetrievedDocument } from "documentdb";
import { inject, injectable, named } from "inversify";
import { ILoggingProvider } from "../logging/iLoggingProvider";
import { ITelemProvider } from "../telem/itelemprovider";
import { DateUtilities } from "../utilities/dateUtilities";

/**
 * Handles executing queries against CosmosDB
 */
@injectable()
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
    private static _buildCollectionLink(database: string, collection: string): string {
        const dbLink: string = CosmosDBProvider._buildDBLink(database);
        return `${dbLink}/colls/${collection}`;
    }

    /**
     * Builds a document link. Generates this over querying CosmosDB for performance reasons.
     * @param database The name of the database the collection is in.
     * @param collection The name of the collection.
     * @param documentId The id of the document to retrieve.
     */
    private static _buildDocumentLink(database: string, collection: string, documentId: string): string {
        const collectionLink: string = CosmosDBProvider._buildCollectionLink(database, collection);
        return `${collectionLink}/docs/${documentId}/`;
    }

    private docDbClient: DocumentClient;

    /**
     * Creates a new instance of the CosmosDB class.
     * @param url The url of the CosmosDB.
     * @param accessKey The CosmosDB access key (primary of secondary).
     * @param telem Telemetry provider used for metrics/events.
     * @param logger Logging provider user for tracing/logging.
     */
    constructor(@inject("string") @named("cosmosDbUrl") private url: string,
                @inject("string") @named("cosmosDbKey") accessKey: string,
                @inject("ITelemProvider") private telem: ITelemProvider,
                @inject("ILoggingProvider") private logger: ILoggingProvider) {
        this.docDbClient = new DocumentClient(url, {
            masterKey: accessKey,
        });
        this.url = url;
        this.telem = telem;
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
        options?: FeedOptions): Promise<RetrievedDocument[]> {

        // Wrap all functionality in a promise to avoid forcing the caller to use callbacks
        return new Promise((resolve, reject) => {
            const collectionLink: string = CosmosDBProvider._buildCollectionLink(database, collection);

            // Get the timestamp immediately before the call to queryDocuments
            const timer: () => number = DateUtilities.getTimer();
            this.docDbClient.queryDocuments(collectionLink, query, options).toArray((err, results, headers) => {
                this.logger.Trace("In CosmosDB queryDocuments");

                // Set values for dependency telemetry.
                // TODO: Figure out how to extract the part of the query after the '?' in the request
                const data: string = query.toString();
                const resultCode: string = (err == null) ? "" : err.code.toString();
                const success: boolean = (err == null) ? true : false;

                // Get an object to track dependency information from the telemetry provider.
                const dependencyTelem: any = this.telem.getDependencyTrackingObject(
                    "CosmosDB", // dependencyTypeName
                    this.url,   // name
                    data,       // query string
                    resultCode,
                    success,
                    timer(),    // duration
                );

                // Track DependencyTelemetry for query
                this.telem.trackDependency(dependencyTelem);

                // Get an object to track query time metric
                const metricTelem: any = this.telem.getMetricTelemetryObject(
                    "CosmosDB: QueryDocuments Duration",
                    timer(),
                );

                // Track CosmosDB query time metric
                this.telem.trackMetric(metricTelem);

                // Check for and log the db op RU cost
                if (headers["x-ms-request-charge"]) {
                    this.logger.Trace(`queryDocument RU Cost: ${headers["x-ms-request-charge"]}`);
                    const ruMetricTelem: any = this.telem.getMetricTelemetryObject(
                        "CosmosDB: queryDocument RU Cost",
                        headers["x-ms-request-charge"],
                    );
                    this.telem.trackMetric(ruMetricTelem);
                }
                this.logger.Trace("Returning from query documents: Result: " + resultCode);

                if (err == null) {
                    resolve(results);
                } else {
                    reject(`${err.code}: ${err.body}`);
                }
            });
        });
    }

    /**
     * Runs the given query against CosmosDB.
     * @param database The database the document is in.
     * @param query The query to select the documents.
     */
    public async queryCollections(
        database: string,
        query: DocumentQuery): Promise<RetrievedDocument[]> {

        // Wrap all functionality in a promise to avoid forcing the caller to use callbacks
        return new Promise((resolve, reject) => {
            const dbLink: string = CosmosDBProvider._buildDBLink(database);

            this.logger.Trace("In CosmosDB queryCollections");
            const timer: () => number = DateUtilities.getTimer();
            this.docDbClient.queryCollections(dbLink, query).toArray((err, results, headers) => {
                // Check for and log the db op RU cost
                if (headers["x-ms-request-charge"]) {
                    this.logger.Trace(`queryCollections RU Cost: ${headers["x-ms-request-charge"]}`);
                    const ruMetricTelem: any = this.telem.getMetricTelemetryObject(
                        "CosmosDB: queryCollections RU Cost",
                        headers["x-ms-request-charge"],
                    );
                    this.telem.trackMetric(ruMetricTelem);
                }

                // Get an object to track delete time metric
                const metricTelem: any = this.telem.getMetricTelemetryObject(
                    "CosmosDB: queryCollections Duration",
                    timer(),
                );

                // Track CosmosDB query time metric
                this.telem.trackMetric(metricTelem);

                if (err == null) {
                    this.logger.Trace("queryCollections returned success");
                    resolve(results);
                } else {
                    this.logger.Error(Error(err.body), "queryCollections returned error");
                    reject(`${err.code}: ${err.body}`);
                }
            });
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
            this.logger.Trace("In CosmosDB getDocument");

            const getDocumentStartTime: number = DateUtilities.getTimestamp();
            const documentLink: string = CosmosDBProvider._buildDocumentLink(database, collection, documentId);

            this.docDbClient.readDocument(documentLink, { partitionKey }, (err, result, headers) => {
                // Check for and log the db op RU cost
                if (headers["x-ms-request-charge"]) {
                    this.logger.Trace(`getDocument RU Cost: ${headers["x-ms-request-charge"]}`);
                    const ruMetricTelem: any = this.telem.getMetricTelemetryObject(
                        "CosmosDB: getDocument RU Cost",
                        headers["x-ms-request-charge"],
                    );
                    this.telem.trackMetric(ruMetricTelem);
                }

                const getDocumentEndTime: number = DateUtilities.getTimestamp();
                const getDocumentDuration: number = getDocumentEndTime - getDocumentStartTime;

                // Get an object to track upsertDocument time metric
                const metricTelem: any = this.telem.getMetricTelemetryObject(
                    "CosmosDB: getDocument Duration",
                    getDocumentDuration,
                );

                // Track CosmosDB query time metric
                this.telem.trackMetric(metricTelem);

                if (err == null) {
                    this.logger.Trace("Returning from get document successfully");
                    resolve(result);
                } else {
                    this.logger.Error(Error(err.body), "getDocument returned error");
                    reject(`${err.code} - ${err.body}`);
                }
            });
        });
    }
}
