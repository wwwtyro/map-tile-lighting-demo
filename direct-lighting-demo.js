const demo = require("./demo");
const fs = require("fs");

const REGL = require("regl");
const { vec3 } = require("gl-matrix");

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
  const regl = REGL({ canvas: canvas, extensions: ["OES_texture_float"] });

  // Create a texture from the terrain-rgb tile.
  const tElevation = regl.texture({
    data: image,
    flipY: true
  });

  // Create a floating point texture that will store the elevation data.
  const fboElevation = regl.framebuffer({
    width: image.width,
    height: image.height,
    colorType: "float"
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
      elevationScale: 1.0,
      resolution: [image.width, image.height]
    },
    viewport: { x: 0, y: 0, width: image.width, height: image.height },
    framebuffer: fboElevation,
    count: 6
  });

  cmdProcessElevation();

  // Calculate the width of a single pixel in meters.
  long0 = demo.tile2long(tLong, zoom);
  long1 = demo.tile2long(tLong + 1, zoom);
  const pixelScale =
    (6371000 * (long1 - long0) * 2 * Math.PI) / 360 / image.width;

  // Create the regl framebuffer we'll store the normals in.
  const fboNormal = regl.framebuffer({
    width: image.width,
    height: image.height,
    colorType: "float"
  });

  // Create the regl command that will calculate the normals.
  const cmdNormal = regl({
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
      uniform float pixelScale;

      void main() {
        vec2 dr = 1.0/resolution;
        float p0 = texture2D(tElevation, dr * (gl_FragCoord.xy + vec2(0.0, 0.0))).r;
        float px = texture2D(tElevation, dr * (gl_FragCoord.xy + vec2(1.0, 0.0))).r;
        float py = texture2D(tElevation, dr * (gl_FragCoord.xy + vec2(0.0, 1.0))).r;
        vec3 dx = vec3(pixelScale, 0.0, px - p0);
        vec3 dy = vec3(0.0, pixelScale, py - p0);
        vec3 n = normalize(cross(dx, dy));
        gl_FragColor = vec4(n, 1.0);
      }
    `,
    attributes: {
      position: [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]
    },
    uniforms: {
      tElevation: fboElevation,
      pixelScale: pixelScale,
      resolution: [image.width, image.height]
    },
    viewport: { x: 0, y: 0, width: image.width, height: image.height },
    framebuffer: fboNormal,
    count: 6
  });

  cmdNormal();

  const cmdDirect = regl({
    vert: `
      precision highp float;
      attribute vec2 position;

      void main() {
        gl_Position = vec4(position, 0, 1);
      }
    `,
    frag: `
      precision highp float;

      uniform sampler2D tNormal;
      uniform vec2 resolution;
      uniform vec3 sunDirection;

      void main() {
        vec2 dr = 1.0/resolution;
        vec3 n = texture2D(tNormal, gl_FragCoord.xy/resolution).rgb;
        float l = dot(n, sunDirection);
        l = 0.5 * l + 0.5;
        gl_FragColor = vec4(l, l, l, 1.0);
      }
    `,
    attributes: {
      position: [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]
    },
    uniforms: {
      tNormal: fboNormal,
      resolution: [image.width, image.height],
      sunDirection: vec3.normalize([], [1, 1, 1])
    },
    viewport: { x: 0, y: 0, width: image.width, height: image.height },
    count: 6
  });

  cmdDirect();
}

main();
