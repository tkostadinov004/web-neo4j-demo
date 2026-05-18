import express from "express";

require("dotenv").config();

const neo4j = require("neo4j-driver");
const neo4jUri = process.env.NEO4J_URI;
let database = process.env.NEO4J_DATABASE;
const driver = neo4j.driver(
  neo4jUri,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
);

function test() {
  const session = driver.session({ database: database });
  return session
    .executeRead((tx: any) => tx.run("", { title: "test" }))
    .then((result: { records: any[] }) => {
      return result.records.map((record: { get: (arg0: string) => any }) => {
        return {};
      });
    })
    .catch((error: any) => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

const port = "3000";
const app = express();

app.get("/", (req, res) => {
  test();
});

app.listen(port, () => {
  console.log(`Demo app listening on port ${port}`);
});
