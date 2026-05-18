import { find_shortest_path_nodes } from "./db/neo";
import {
  get_all_cinemas,
  get_closest_vertex_id,
  get_path_by_nodes,
} from "./db/postgis";

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

export async function fetch_distance_to_cinemas(
  lat: number,
  lon: number,
): Promise<ShortestPathResponse[]> {
  const closest_vertex_to_origin = await get_closest_vertex_id(lat, lon);
  if (!closest_vertex_to_origin) {
    throw new Error("Unable to get closest vertex to origin coordinates!");
  }

  const cinemas = await get_all_cinemas();
  let result: ShortestPathResponse[] = (
    await Promise.all(
      cinemas.map(async (c) => {
        const closest_vertex_id = await get_closest_vertex_id(c.lat, c.lon);
        if (!closest_vertex_id) {
          throw new Error(
            "Unable to get closest vertex to cinema coordinates!",
          );
        }
        const shortest_path_neo = await find_shortest_path_nodes(
          closest_vertex_to_origin,
          closest_vertex_id,
        );
        if (!shortest_path_neo) {
          return null;
        }
        const shortest_path = await get_path_by_nodes(
          shortest_path_neo.path.join(", "),
        );
        if (!shortest_path) {
          return null;
        }
        return new ShortestPathResponse(
          c.id,
          shortest_path,
          shortest_path_neo.total_cost,
        );
      }),
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
