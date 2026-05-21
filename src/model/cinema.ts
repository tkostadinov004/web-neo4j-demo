export class Cinema {
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
