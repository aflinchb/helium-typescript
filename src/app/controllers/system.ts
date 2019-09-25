import { DocumentQuery, RetrievedDocument } from "documentdb";
import { inject, injectable, named } from "inversify";
import { Controller, Get, interfaces } from "inversify-restify-utils";
import * as HttpStatus from "http-status-codes";
import { IDatabaseProvider } from "../../db/idatabaseprovider";
import { ILoggingProvider } from "../../logging/iLoggingProvider";
import { ITelemProvider } from "../../telem/itelemprovider";
/**
 * controller implementation for our system endpoint
 */
@Controller("/healthz")
@injectable()
export class SystemController implements interfaces.Controller {
    private database: string;
    private collection: string;

    constructor(@inject("string") @named("database") database: string,
                @inject("string") @named("collection") collection: string,
                @inject("IDatabaseProvider") private cosmosDb: IDatabaseProvider,
                @inject("ITelemProvider") private telem: ITelemProvider,
                @inject("ILoggingProvider") private logger: ILoggingProvider) {
        this.cosmosDb = cosmosDb;
        this.telem = telem;
        this.logger = logger;
        this.database = database;
        this.collection = collection;
    }

    /**
     * @swagger
     *
     * /healthz:
     *   get:
     *     description: Returns a count of the Actors, Genres and Movies as text/plain
     *     tags:
     *       - System
     *     responses:
     *       '200':
     *         description: returns a count of the Actors, Genres and Movies as text/plain
     *         content:
     *              text/plain:
     *                  schema:
     *                      type: string
     *                      example: "Movies: 100\r\nActors: 553\r\nGenres: 20"
     *       '400':
     *         description: failed due to unexpected results
     *       default:
     *         description: Unexpected error
     */
    @Get("/")
    public async healthcheck(req, res) {
        // healthcheck counts the document types
        // Should return: "Movies: 100\r\nActors: 553\r\nGenres: 20" as text/plain
        let resCode: number = HttpStatus.OK;
        let resMessage: string = "";

        try {
           resMessage += await this.getcount("Movie") + "\r\n";
           resMessage += await this.getcount("Actor") + "\r\n";
           resMessage += await this.getcount("Genre");
        } catch (e) {
           resCode = HttpStatus.INTERNAL_SERVER_ERROR;
           resMessage = "Healthz Exception: " + e;
        }
        res.setHeader("Content-Type", "text/plain");
        return res.send(resCode, resMessage);
    }

    private async getcount(type) {
        let results: RetrievedDocument[];
        const querySpec: DocumentQuery = {
            parameters: [
                {
                    name: "@type",
                    value: type,
                },
            ],
            query: `select value count(1) from m where m.type = @type`,
        };

        results = await this.cosmosDb.queryDocuments(
            this.database,
            this.collection,
            querySpec,
            { enableCrossPartitionQuery: true },
        );

        return type + "s: " + results[0];
    }
}
