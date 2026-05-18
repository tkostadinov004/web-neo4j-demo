import neo4j from "neo4j-driver";

require("dotenv").config();
const driver = neo4j.driver(
  process.env.NEO4J_URI ?? "",
  neo4j.auth.basic(
    process.env.NEO4J_USER ?? "",
    process.env.NEO4J_PASSWORD ?? "",
  ),
);

const create_session = function () {
  return driver.session({ database: process.env.NEO4J_DATABASE });
};

class NeoResponse {
  path: string[];
  total_cost: number;

  constructor(path: string[], total_cost: number) {
    this.path = path;
    this.total_cost = total_cost;
  }
}

export async function find_shortest_path_nodes(
  source_id: number,
  target_id: number,
): Promise<NeoResponse | null> {
  const session = create_session();
  const res = await session.executeRead((tx) =>
    tx.run(
      `
        MATCH (source:Intersection {id: $source_id})
        MATCH (target:Intersection {id: $target_id})

        CALL gds.shortestPath.dijkstra.stream('streetNetwork', {
        sourceNode: source,
        targetNode: target,
        relationshipWeightProperty: 'cost'
        })
        YIELD path, totalCost

        RETURN 
        totalCost,
        [node IN nodes(path) | node.id] AS node_sequence;
    `,
      { source_id: source_id.toString(), target_id: target_id.toString() },
    ),
  );
  return res.records.length == 0
    ? null
    : new NeoResponse(
        res.records[0].get("node_sequence"),
        res.records[0].get("totalCost"),
      );
}
