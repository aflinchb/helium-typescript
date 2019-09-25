import { DocumentQuery, RetrievedDocument } from "documentdb";
import { inject, injectable, named } from "inversify";
import { Controller, Get, interfaces } from "inversify-restify-utils";
import { Request } from "restify";
import * as HttpStatus from "http-status-codes";
import { IDatabaseProvider } from "../../db/idatabaseprovider";
import { ILoggingProvider } from "../../logging/iLoggingProvider";
import { ITelemProvider } from "../../telem/itelemprovider";
import { QueryUtilities } from "../../utilities/queryUtilities";
import { actorDoesNotExistError } from "../../config/constants";

// Controller implementation for our actors endpoint
@Controller("/api/actors")
@injectable()
export class ActorController implements interfaces.Controller {
    private database: string;
    private collection: string;

    // Instantiate the actor controller
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
     * /api/actors:
     *   get:
     *     description: Retrieve and return all actors.
     *     tags:
     *       - Actors
     *     parameters:
     *       - name: q
     *         description: The actor name to filter by.
     *         in: query
     *         schema:
     *           type: string
     *     responses:
     *       '200':
     *         description: List of actor objects
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Actor'
     *       default:
     *         description: Unexpected error
     */
    @Get("/")
    public async getAll(req: Request, res) {

        let querySpec: DocumentQuery;

        // Actor name is an optional query param.
        // If not specified, we should query for all actors.
        const actorName: string = req.query.q;
        if (actorName === undefined) {
            querySpec = {
                parameters: [],
                query: `SELECT root.id, root.partitionKey, root.actorId, root.type,
                root.name, root.birthYear, root.deathYear, root.profession, root.textSearch, root.movies
                FROM root
                WHERE root.type = 'Actor'`,
            };
        } else {
            querySpec = {
                parameters: [
                    {
                        name: "@actorname",
                        value: actorName.toLowerCase(),
                    },
                ],
                query: `SELECT root.id, root.partitionKey, root.actorId, root.type,
                root.name, root.birthYear, root.deathYear, root.profession, root.textSearch, root.movies
                FROM root
                WHERE CONTAINS(root.textSearch, @actorname) AND root.type = 'Actor'`,
            };
        }

        // make query, catch errors
        let resCode: number = HttpStatus.OK;
        let results: RetrievedDocument[];
        try {
            results = await this.cosmosDb.queryDocuments(
                this.database,
                this.collection,
                querySpec,
                { enableCrossPartitionQuery: true },
            );
        } catch (err) {
            resCode = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        return res.send(resCode, results);
    }

    /**
     * @swagger
     *
     * /api/actors/{id}:
     *   get:
     *     description: Retrieve and return a single actor by actor ID.
     *     tags:
     *       - Actors
     *     parameters:
     *       - name: id
     *         description: The ID of the actor to look for.
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       '200':
     *         description: The actor object
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Actor'
     *       '404':
     *         description: An actor with the specified ID was not found.
     *       default:
     *         description: Unexpected error
     */
    @Get("/:id")
    public async getActorById(req, res) {

        const actorId: string = req.params.id;

        // make query, catch errors
        let resCode: number = HttpStatus.OK;
        let result: RetrievedDocument;
        try {
          result = await this.cosmosDb.getDocument(this.database,
            this.collection,
            QueryUtilities.getPartitionKey(actorId),
            actorId);
        } catch (err) {
          if (err.toString().includes("NotFound")) {
            resCode = HttpStatus.NOT_FOUND;
            result = actorDoesNotExistError;
          } else {
            resCode = HttpStatus.INTERNAL_SERVER_ERROR;
            result = err.toString();
          }
        }

        return res.send(resCode, result);
    }
}
