import express from "express";
import { get_all_cinemas } from "./db/postgis";
import path from "path";
import { fetch_distance_to_cinemas } from "./cinema_service";

require("dotenv").config();
const port = "3000";
const public_dir = "public";
const app = express();
app.use(express.static(public_dir));

app.get("/", (req, res) => {
  res.sendFile(path.join(public_dir, "index.html"));
});

app.get("/cinemas", async (req, res) => {
  res.json(await get_all_cinemas());
});

app.get("/distance_to_cinemas", async (req, res) => {
  if (!req.query.lat || !req.query.lon) {
    res.status(400).json({ message: "Provide latitude and longitude!" });
    return;
  }

  res.send(
    await fetch_distance_to_cinemas(
      Number.parseFloat(req.query.lat.toString()),
      Number.parseFloat(req.query.lon.toString()),
    ),
  );
});

app.listen(port, () => {
  console.log(`Demo app listening on port ${port}`);
});
