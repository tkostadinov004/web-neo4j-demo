import { Pool, PoolClient } from "pg";
import format from "pg-format";
import { Cinema } from "../model/cinema";
import { from } from "pg-copy-streams";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export class Path {
  cost: number;
  line_geojson: string;

  constructor(cost: number, line_geojson: string) {
    this.cost = cost;
    this.line_geojson = line_geojson;
  }
}

const get_pg_pool = function () {
  return new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASS,
    port: Number.parseInt(process.env.PG_PORT ?? ""),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: true,
  });
};

export async function get_closest_vertex_id(lat: number, lon: number): Promise<number | null> {
  const pool: Pool = get_pg_pool();
  let conn;
  try {
    conn = await pool.connect();
    const res = await conn.query(
      format(
        `
        select id from pedestrian_network_noded_vertices_pgr
        order by the_geom <-> st_setsrid(st_point(%L, %L), 4326)
        limit 1;
        `,
        lon,
        lat
      )
    );
    return res.rowCount == 0 ? null : res.rows[0].id;
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

async function import_data(conn: PoolClient, nodes: string) {
  const stream = conn.query(from("copy path_sequences (object_id, cost, geom_path) from STDIN with CSV HEADER"));
  const sourceStream = Readable.from(nodes);

  await pipeline(sourceStream, stream);
}

export async function get_path_by_nodes(nodes: string): Promise<Map<number, Path>> {
  const pool: Pool = get_pg_pool();
  let conn;
  try {
    conn = await pool.connect();
    await import_data(conn, nodes);

    const res = await conn.query(
      `
          with nodes as (
              select object_id, cost, node_geom as geom, ord
              from path_sequences
              cross join lateral unnest(string_to_array(geom_path, ', ')) with ordinality as t(node_geom, ord)
          ), pair_edges as (
              select n1.object_id, n1.cost, st_makeline(n1.geom, n2.geom) as line_between
              from nodes as n1
              join nodes as n2 on n1.object_id = n2.object_id and n2.ord = n1.ord + 1
          )
          select object_id, cost, st_asgeojson(st_union(line_between)) as path
          from pair_edges
          group by object_id, cost;
        `
    );
    let result: Map<number, Path> = new Map();
    res.rows.forEach((r) => result.set(r.object_id, new Path(r.cost, r.path)));

    await conn.query("truncate table path_sequences;");
    return result;
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

export async function get_all_cinemas(): Promise<Cinema[]> {
  const pool: Pool = get_pg_pool();
  let conn;
  try {
    conn = await pool.connect();
    const res = await conn.query(
      `
        select ogc_fid as id, st_y(wkb_geometry) as lat, 
          st_x(wkb_geometry) as lon, 
          name, (select pnnvp.id from pedestrian_network_noded_vertices_pgr pnnvp order by pnnvp.the_geom <-> wkb_geometry limit 1) as closest_vertex
	      from cinemas;
      `
    );
    return res.rows.map((r) => new Cinema(r.id, r.lat, r.lon, r.name, Number.parseInt(r.closest_vertex)));
  } finally {
    if (conn) {
      conn.release();
    }
  }
}
