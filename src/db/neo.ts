import neo4j from "neo4j-driver";

require("dotenv").config();
const driver = neo4j.driver(process.env.NEO4J_URI ?? "", neo4j.auth.basic(process.env.NEO4J_USER ?? "", process.env.NEO4J_PASSWORD ?? ""));

const create_session = function () {
  return driver.session({ database: process.env.NEO4J_DATABASE });
};

export class NeoResponse {
  target_id: number;
  path: string[];
  total_cost: number;

  constructor(target_id: number, path: string[], total_cost: number) {
    this.target_id = target_id;
    this.path = path;
    this.total_cost = total_cost;
  }
}

export async function find_shortest_path_nodes(source_id: number, target_ids: number[]): Promise<string> {
  const session = create_session();
  const res = await session.executeRead((tx) =>
    tx.run(
      `
        CALL apoc.export.csv.query("
          MATCH (start:Intersection {id: $source_id})
          MATCH (end:Intersection) WHERE end.id IN $target_ids

          CALL gds.shortestPath.dijkstra.stream('streetNetwork', {
            sourceNode: start,
            targetNode: end,
            relationshipWeightProperty: 'cost'
          })
          YIELD path, totalCost

          RETURN end.id as end_id, totalCost, apoc.text.join([node IN nodes(path) |  node.geom], ', ') as geom_sequence
        ", null, {stream:true, params: {source_id: $source_id, target_ids: $target_ids}})
        YIELD data
        RETURN data;
    `,
      { source_id: source_id.toString(), target_ids: target_ids.map((t) => t.toString()) }
    )
  );
  return res.records[0].get("data");
}
