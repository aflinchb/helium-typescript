/**
 * Utilities for querying from CosmosDB.
 */
export class QueryUtilities {

    // Compute the partition key based on the movieId or actorId
    // For this sample, the partition key is always "0"
    /// In a full implementation, you would have multiple partition for scaling
    public static getPartitionKey(id: string): string {
        let idInt: number = 0;
        if ( id.length < 5 && (id.startsWith("tt") || id.startsWith("nm"))) {
            idInt = parseInt(id.substring(2), 10);
        }

        return isNaN(idInt) ? "" : (idInt % 1).toString();
    }
}
