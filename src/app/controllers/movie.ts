import { DocumentQuery, RetrievedDocument } from "documentdb";
import { inject, injectable, named } from "inversify";
import { Controller, Get, interfaces } from "inversify-restify-utils";
import * as HttpStatus from "http-status-codes";
import { IDatabaseProvider } from "../../db/idatabaseprovider";
import { ILoggingProvider } from "../../logging/iLoggingProvider";
import { ITelemProvider } from "../../telem/itelemprovider";
import { QueryUtilities } from "../../utilities/queryUtilities";
import { movieDoesNotExistError } from "../../config/constants";

/**
 * controller implementation for our movies endpoint
 */
@Controller("/api/movies")
@injectable()
export class MovieController implements interfaces.Controller {
    private database: string;
    private collection: string;

    // Must be type Any so we can return the string in GET API calls.
    private static readonly movieDoesNotExistError: any = "A Movie with that ID does not exist";

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
     * /api/movies:
     *   get:
     *     description: Retrieve and return all movies!
     *     tags:
     *       - Movies
     *     parameters:
     *       - name: q
     *         description: The movie title to filter by.
     *         in: query
     *         schema:
     *           type: string
     *     responses:
     *       '200':
     *         description: List of movie objects
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Movie'
     *       default:
     *         description: Unexpected error
     */
    @Get("/")
    public async getAll(req, res) {
        let querySpec: DocumentQuery;

        // Movie name is an optional query param.
        // If not specified, we should query for all movies.
        const movieName: string = req.query.q;
        if (movieName === undefined) {
            querySpec = {
                parameters: [],
                query: `SELECT root.id, root.partitionKey, root.movieId, root.type, root.textSearch,
                root.title, root.year, root.runtime, root.rating, root.votes, root.totalScore, root.genres, root.roles
                FROM root where root.type = 'Movie'`,
            };
        } else {
            // Use StartsWith in the title search since the textSearch property always starts with the title.
            // This avoids selecting movies with titles that also appear as Actor names or Genres.
            // Make the movieName lowercase to match the case in the search.
            querySpec = {
                parameters: [
                    {
                        name: "@title",
                        value: movieName.toLowerCase(),
                    },
                ],
                query: `SELECT root.id, root.partitionKey, root.movieId, root.type, root.textSearch,
                root.title, root.year, root.runtime, root.rating, root.votes, root.totalScore, root.genres, root.roles
                FROM root where CONTAINS(root.textSearch, @title) and root.type = 'Movie'`,
            };
        }

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
     * /api/movies/{id}:
     *   get:
     *     description: Retrieve and return a single movie by movie ID.
     *     tags:
     *       - Movies
     *     parameters:
     *       - name: id
     *         description: The ID of the movie to look for.
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       '200':
     *         description: The movie object
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Movie'
     *       '404':
     *         description: A movie with the specified ID was not found.
     *       default:
     *         description: Unexpected error
     */
    @Get("/:id")
    public async getMovieById(req, res) {
        const movieId: string = req.params.id;

        let resCode: number = HttpStatus.OK;
        let result: RetrievedDocument;
        try {
            result = await this.cosmosDb.getDocument(this.database,
                this.collection,
                QueryUtilities.getPartitionKey(movieId),
                movieId);
        } catch (err) {
            if (err.toString().includes("NotFound")) {
                resCode = HttpStatus.NOT_FOUND;
                result = movieDoesNotExistError;
            } else {
                resCode = HttpStatus.INTERNAL_SERVER_ERROR;
                result = err.toString();
            }
        }

        return res.send(resCode, result);
    }
}
