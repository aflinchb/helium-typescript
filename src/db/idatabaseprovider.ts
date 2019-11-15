import { SqlQuerySpec, Item, FeedOptions } from "@azure/cosmos";
import { Actor } from "../app/models/actor";

export interface IDatabaseProvider {
    /**
     * Runs the given query against CosmosDB.
     * @param query The query to select the documents.
     */
    queryDocuments(query: SqlQuerySpec,
                   options?: FeedOptions): Promise<any[]>;

    /**
     * Retrieves a specific document by Id.
     * @param partitionKey The partition key for the document.
     * @param documentId The id of the document to query.
     */
    getDocument(partitionKey: string,
                documentId: string): Promise<any>;         
}
