const demo = require("./demo");
const fs = require("fs");

const REGL = require("regl");

const MAPBOX_KEY = fs.readFileSync("mapbox.key").toString();

async function main() {
  // Define a zoom and a (lat,long) location.
  const zoom = 10;
  const [lat, long] = [36.133487, -112.239884]; // Grand Canyon

  // Determine the tile coordinates for the location and zoom level.
  const tLat = Math.floor(demo.lat2tile(lat, zoom));
  const tLong = Math.floor(demo.long2tile(long, zoom));

  // Download the terrain-rgb tile.
  const image = await demo.loadImage(
    `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tLong}/${tLat}.pngraw?access_token=${MAPBOX_KEY}`
  );

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  document.body.appendChild(canvas);

  // Create the regl context.
  const regl = REGL({ canvas: canvas });

  // Create a texture from the terrain-rgb tile.
  const tElevation = regl.texture({
    data: image,
    flipY: true
  });

  // Create the regl command that will process the terrain-rgb tile.
  const cmdProcessElevation = regl({
    vert: `
      precision highp float;
      attribute vec2 position;

      void main() {
        gl_Position = vec4(position, 0, 1);
      }
    `,
    frag: `
      precision highp float;

      uniform sampler2D tElevation;
      uniform vec2 resolution;
      uniform float elevationScale;

      void main() {
        // Sample the terrain-rgb tile.
        vec3 rgb = texture2D(tElevation, gl_FragCoord.xy/resolution).rgb;

        // Convert the red, green, and blue channels into an elevation.
        float e = -10000.0 + ((rgb.r * 255.0 * 256.0 * 256.0 + rgb.g * 255.0 * 256.0 + rgb.b * 255.0) * 0.1);

        // Scale the elevation and write it out.
        gl_FragColor = vec4(vec3(e * elevationScale), 1.0);
      }
    `,
    attributes: {
      position: [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]
    },
    uniforms: {
      tElevation: tElevation,
      elevationScale: 0.0005,
      resolution: [image.width, image.height]
    },
    viewport: { x: 0, y: 0, width: image.width, height: image.height },
    count: 6
  });

  cmdProcessElevation();
}

main();
