import { find_shortest_path_nodes, NeoResponse } from "./db/neo";
import { get_all_cinemas, get_closest_vertex_id, get_path_by_nodes } from "./db/postgis";

export class ShortestPathResponse {
  cinema_id: number;
  path: string;
  total_cost: number;
  is_closest: boolean = false;

  constructor(cinema_id: number, path: string, total_cost: number) {
    this.cinema_id = cinema_id;
    this.path = path;
    this.total_cost = total_cost;
  }
}

export async function fetch_distance_to_cinemas(lat: number, lon: number): Promise<ShortestPathResponse[]> {
  const closest_vertex_to_origin = await get_closest_vertex_id(lat, lon);
  if (!closest_vertex_to_origin) {
    throw new Error("Unable to get closest vertex to origin coordinates!");
  }

  const cinemas = await get_all_cinemas();
  const shortest_paths_to_cinemas: Map<number, NeoResponse> = await find_shortest_path_nodes(
    closest_vertex_to_origin,
    cinemas.map((c) => c.closest_vertex_id)
  );

  let result: ShortestPathResponse[] = (
    await Promise.all(
      cinemas.map(async (c) => {
        const shortest_path_nodes = shortest_paths_to_cinemas.get(c.closest_vertex_id);
        if (!shortest_path_nodes) {
          return null;
        }
        const shortest_path = await get_path_by_nodes(shortest_path_nodes.path.join(", "));
        if (!shortest_path) {
          return null;
        }
        return new ShortestPathResponse(c.id, shortest_path, shortest_path_nodes.total_cost);
      })
    )
  )
    .filter((sp) => sp != null)
    .toSorted((a, b) => a.total_cost - b.total_cost);

  const shortest_cinema_cost = Math.min(...result.map((sp) => sp.total_cost));
  result.forEach((c) => {
    if (c.total_cost == shortest_cinema_cost) c.is_closest = true;
  });
  return result;
}
