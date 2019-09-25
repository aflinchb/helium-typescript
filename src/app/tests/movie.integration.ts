import * as chai from "chai";
import chaiHttp = require("chai-http");
import "mocha";
import { integrationServer } from "../../config/constants";

chai.use(chaiHttp);

describe("Testing Movie Controller Methods", function() {

  describe("GET /api/movies", async () => {
    it("Test ability to get all movies", async () => {
      chai.request(integrationServer)
        .get(`/api/movies`)
        .then((res) => {
          chai.expect(res).to.have.status(200);
          const body = res.body;
          chai.assert.isArray(body);
          chai.assert.equal(body.length, 100);
        });
    });
  });

  describe("GET /api/movies/id", async () => {
    it("Should return a movie", function() {
      chai.request(integrationServer)
        .get("/api/movies/tt0133093")
        .set("content-type", "application/json")
        .end((err, res) => {
          chai.expect(res).to.have.status(200);
          const body = res.body;
          chai.assert.isNotArray(body);
          const title = body.title;
          chai.assert.equal("The Matrix", title);
        });
    });
  });

  describe("GET /api/movies?q=ring", async () => {
    it("Should return 3 movies", async () => {
      chai.request(integrationServer)
        .get("/api/movies?q=" + "ring")
        .query({ q: "ring" })
        .set("content-type", "application/json")
        .end((err, res) => {
          chai.expect(res).to.have.status(200);
          const body = res.body;
          chai.assert.isArray(body);
          chai.assert.equal(body.length, 3);
        });
    });
  });

  describe("GET /api/movies/id", async () => {
    it("Should fail", function() {
      chai.request(integrationServer)
        .get("/api/movies/badId")
        .set("content-type", "application/json")
        .end((err, res) => {
          chai.expect(res).to.have.status(404);
          chai.assert.isNotNull(res);
        });
    });
  });

});
