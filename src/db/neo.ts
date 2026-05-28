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

export async function find_shortest_path_nodes(source_id: number, target_ids: number[]): Promise<Map<number, NeoResponse>> {
  const session = create_session();
  const res = await session.executeRead((tx) =>
    tx.run(
      `
        MATCH (start:Intersection {id: $source_id})
        MATCH (end:Intersection) WHERE end.id IN $target_ids

        CALL gds.shortestPath.dijkstra.stream('streetNetwork', {
          sourceNode: start,
          targetNode: end,
          relationshipWeightProperty: 'cost'
        })
        YIELD path, totalCost

        RETURN end.id as end_id, totalCost, [node IN nodes(path) | node.geom] as geom_sequence;
    `,
      { source_id: source_id.toString(), target_ids: target_ids.map((t) => t.toString()) }
    )
  );
  let result: Map<number, NeoResponse> = new Map();
  res.records.forEach((r) => result.set(Number.parseInt(r.get("end_id")), new NeoResponse(Number.parseInt(r.get("end_id")), r.get("geom_sequence"), r.get("totalCost"))));
  return result;
}

export async function init_street_graph() {
  const session = create_session();
  await session.executeWrite((tx) => tx.run(`CALL gds.graph.drop('streetNetwork', false);`));
  await session.executeWrite((tx) =>
    tx.run(
      `
        CALL gds.graph.project(
          'streetNetwork',
          'Intersection',
          {
            ROAD: {
              orientation: 'UNDIRECTED'
            }
          },
          {
            relationshipProperties: 'cost'
          }
        );  
      `
    )
  );
}
