import { SqlQuerySpec, FeedOptions, Item } from "@azure/cosmos";
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

    constructor(@inject("IDatabaseProvider") private cosmosDb: IDatabaseProvider,
                @inject("ITelemProvider") private telem: ITelemProvider,
                @inject("ILoggingProvider") private logger: ILoggingProvider) {
        this.cosmosDb = cosmosDb;
        this.telem = telem;
        this.logger = logger;
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
        let results: string[];
        const querySpec: SqlQuerySpec = {
            parameters: [
                {
                    name: "@type",
                    value: type,
                },
            ],
            query: `select value count(1) from m where m.type = @type`,
        };

        results = await this.cosmosDb.queryDocuments(
            querySpec,
            { maxItemCount: 2000 },
        );

        return type + "s: " + results[0];
    }
}
