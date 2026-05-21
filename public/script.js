const map = L.map("map").setView([42.6977, 23.3219], 13);

L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  maxZoom: 19,
}).addTo(map);

let starting_marker = null;
let cinema_markers = {};
let path_layers = [];
let global_cinemas_data = [];
let cinema_names = {};

const calc_btn = document.getElementById("calc-btn");
const loader_overlay = document.getElementById("loader-overlay");
const table_body = document.getElementById("cinema-table-body");

const start_icon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const yellow_icon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const default_blue_icon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

async function fetch_cinemas() {
  const result = await fetch("/cinemas", {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  return await result.json();
}

async function api_calculate_paths(start_lat_lng, cinemas) {
  const res = await fetch(`/distance_to_cinemas?lat=${start_lat_lng.lat}&lon=${start_lat_lng.lng}`);
  const data = await res.json();
  return data;
}

async function init() {
  loader_overlay.classList.add("active");
  try {
    global_cinemas_data = await fetch_cinemas();

    global_cinemas_data.forEach((cinema) => {
      const marker = L.marker([cinema.lat, cinema.lon], { icon: default_blue_icon }).addTo(map);

      marker.bindPopup(`
            <div style="font-size: 14px;">
                <h3 style="margin: 0 0 5px 0;">${cinema.name}</h3>
            </div>
        `);

      cinema_markers[cinema.id] = marker;
      cinema_names[cinema.id] = cinema.name;
    });
  } finally {
    loader_overlay.classList.remove("active");
  }
}

map.on("click", function (e) {
  if (starting_marker) {
    starting_marker.setLatLng(e.latlng);
  } else {
    starting_marker = L.marker(e.latlng, { icon: start_icon }).addTo(map);
    starting_marker.bindPopup("<b>Начална точка</b>").openPopup();

    calc_btn.disabled = false;
  }

  clear_paths();
});

calc_btn.addEventListener("click", async () => {
  if (!starting_marker) return;

  loader_overlay.classList.add("active");
  calc_btn.disabled = true;

  try {
    const start_lat_lng = starting_marker.getLatLng();
    let paths = await api_calculate_paths(start_lat_lng, global_cinemas_data);

    clear_paths();
    table_body.innerHTML = "";

    paths.forEach((path_obj) => {
      if (cinema_markers[path_obj.cinema_id]) {
        if (path_obj.is_closest) {
          cinema_markers[path_obj.cinema_id].setIcon(yellow_icon);
        } else {
          cinema_markers[path_obj.cinema_id].setIcon(default_blue_icon);
        }
      }

      const path_options = path_obj.is_closest
        ? {
            color: "#28a745", // Green
            weight: 6,
            opacity: 1,
            dashArray: null,
          }
        : {
            color: "#007BFF", // Blue
            weight: 2,
            opacity: 0.3, // Low opacity
            dashArray: "2, 4", // Dashed line
          };

      const line = L.geoJSON(JSON.parse(path_obj.path), {
        style: path_options,
      }).addTo(map);

      if (path_obj.is_closest) {
        line.bringToFront();
        line.bindTooltip(`Най-близко: ${path_obj.total_cost.toFixed(2)} минути`, {
          permanent: false,
          sticky: true,
        });
      }

      path_layers.push(line);

      const cinema_name = cinema_names[path_obj.cinema_id];

      const tr = document.createElement("tr");
      tr.className = path_obj.is_closest ? "row-closest" : "row-other";

      tr.innerHTML = `
        <td>${cinema_name}</td>
        <td>${path_obj.total_cost.toFixed(2)}</td>
      `;

      table_body.appendChild(tr);
    });
  } catch (error) {
    console.error("Error calculating paths:", error);
    alert("Грешка при пресмятането на пътищата. Опитай отново!");
  } finally {
    loader_overlay.classList.remove("active");
    calc_btn.disabled = false;
  }
});

function clear_paths() {
  path_layers.forEach((layer) => map.removeLayer(layer));
  path_layers = [];
  table_body.innerHTML = "";
}

init();
