const demo = require("./demo");
const fs = require("fs");

const MAPBOX_KEY = fs.readFileSync("mapbox.key").toString();

async function main() {
  // Define a zoom and a (lat,long) location.
  const zoom = 10;
  const [lat, long] = [36.133487, -112.239884]; // Grand Canyon

  // Determine the tile coordinates for the location and zoom level.
  const tLat = Math.floor(demo.lat2tile(lat, zoom));
  const tLong = Math.floor(demo.long2tile(long, zoom));

  // Download the tile image.
  const image = await demo.loadImage(
    `https://api.mapbox.com/v4/mapbox.satellite/${zoom}/${tLong}/${tLat}.pngraw?access_token=${MAPBOX_KEY}`
  );

  // Display it.
  document.body.appendChild(image);
}

main();
