import { Pool } from "pg";
import format from "pg-format";

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

class Cinema {
  id: number;
  lat: number;
  lon: number;
  name: string;
  closest_vertex_id: number;

  constructor(id: number, lat: number, lon: number, name: string, closest_vertex_id: number) {
    this.id = id;
    this.lat = lat;
    this.lon = lon;
    this.name = name;
    this.closest_vertex_id = closest_vertex_id;
  }
}

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

export async function get_path_by_nodes(nodes: string): Promise<string | null> {
  const pool: Pool = get_pg_pool();
  let conn;
  try {
    conn = await pool.connect();
    const res = await conn.query(
      format(
        `
        with nodes as (
            select st_geomfromgeojson(node_geom) as geom, ord
            from unnest(string_to_array(%L, ', '))
            with ordinality as t(node_geom, ord)
        ), pair_edges as (
            select st_makeline(n1.geom, n2.geom) as line_between
            from nodes as n1
            join nodes as n2 on n2.ord = n1.ord + 1
        )
        select st_asgeojson(st_union(line_between)) as path from pair_edges;
        `,
        nodes
      )
    );
    return res.rowCount == 0 ? null : res.rows[0].path;
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
    return res.rows.map((r) => new Cinema(r.id, r.lat, r.lon, r.name, r.closest_vertex));
  } finally {
    if (conn) {
      conn.release();
    }
  }
}
