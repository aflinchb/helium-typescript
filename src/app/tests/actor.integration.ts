import * as chai from "chai";
import chaiHttp = require("chai-http");
import "mocha";
import { integrationServer } from "../../config/constants";

chai.use(chaiHttp);

describe("Testing Actor Controller Methods", function() {

  describe("GET /api/actors", async () => {
    it("Test ability to get all actors", async () => {
      chai.request(integrationServer)
        .get(`/api/actors`)
        .then((res) => {
          chai.expect(res).to.have.status(200);
          const body = res.body;
          chai.assert.isArray(body);
          chai.assert.equal(body.length, 553);
        });
    });
  });

  describe("GET /api/actors/id", async () => {
    it("Should return an actor", function() {
      chai.request(integrationServer)
        .get("/api/actors/nm0000173")
        .set("content-type", "application/json")
        .end((err, res) => {
          chai.expect(res).to.have.status(200);
          const body = res.body;
          chai.assert.isNotArray(body);
          const name = body.name;
          chai.assert.equal("Nicole Kidman", name);
        });
    });
  });

  describe("GET /api/actors?q=nicole", async () => {
    it("Should return 3 actors", async () => {
      chai.request(integrationServer)
        .get("/api/actors?q=" + "nicole")
        .query({ q: "nicole" })
        .set("content-type", "application/json")
        .end((err, res) => {
          chai.expect(res).to.have.status(200);
          const body = res.body;
          chai.assert.isArray(body);
          chai.assert.equal(body.length, 3);
        });
    });
  });

  describe("GET /api/actors/id", async () => {
    it("Should fail", function() {
      chai.request(integrationServer)
        .get("/api/actors/badId")
        .set("content-type", "application/json")
        .end((err, res) => {
          chai.expect(res).to.have.status(404);
          chai.assert.isNotNull(res);
        });
    });
  });

});
