import { find_shortest_path_nodes, NeoResponse } from "./db/neo";
import { get_all_cinemas, get_closest_vertex_id, get_path_by_nodes, Path } from "./db/postgis";

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
  const shortest_paths_to_cinemas: string = await find_shortest_path_nodes(
    closest_vertex_to_origin,
    cinemas.map((c) => c.closest_vertex_id)
  );
  const shortest_paths_lines: Map<number, Path> = await get_path_by_nodes(shortest_paths_to_cinemas);

  let result: ShortestPathResponse[] = cinemas
    .map((c) => {
      const path: Path | undefined = shortest_paths_lines.get(c.closest_vertex_id);
      if (!path) {
        return null;
      }
      return new ShortestPathResponse(c.id, path.line_geojson, path.cost);
    })
    .filter((sp) => sp != null)
    .toSorted((a, b) => a.total_cost - b.total_cost);

  const shortest_cinema_cost = Math.min(...result.map((sp) => sp.total_cost));
  result.forEach((c) => {
    if (c.total_cost == shortest_cinema_cost) c.is_closest = true;
  });
  return result;
}
