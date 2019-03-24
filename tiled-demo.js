const demo = require("./demo");
const fs = require("fs");

const REGL = require("regl");
const { vec3 } = require("gl-matrix");

const MAPBOX_KEY = fs.readFileSync("mapbox.key").toString();

async function main() {
  // Define a zoom and a (lat,long) location.
  const zoom = 10;
  const [lat, long] = [36.233487, -112.139884]; // Grand Canyon

  // Determine the tile coordinates for the location and zoom level.
  const tLat = Math.floor(demo.lat2tile(lat, zoom));
  const tLong = Math.floor(demo.long2tile(long, zoom));

  // Download the terrain-rgb region.
  const image = await demo.getRegion(
    tLat,
    tLong,
    zoom,
    `https://api.mapbox.com/v4/mapbox.terrain-rgb/zoom/tLong/tLat.pngraw?access_token=${MAPBOX_KEY}`
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
      elevationScale: 4.0,
      resolution: [image.width, image.height]
    },
    viewport: { x: 0, y: 0, width: image.width, height: image.height },
    framebuffer: fboElevation,
    count: 6
  });

  cmdProcessElevation();

  // Calculate the width of a single pixel in meters.
  long0 = demo.tile2long(tLong - 1, zoom);
  long1 = demo.tile2long(tLong + 2, zoom);
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

  const shadowPP = demo.PingPong(regl, {
    width: image.width,
    height: image.height,
    colorType: "float"
  });

  const cmdSoftShadows = regl({
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
      uniform sampler2D tNormal;
      uniform sampler2D tSrc;
      uniform vec3 sunDirection;
      uniform vec2 resolution;
      uniform float pixelScale;

      void main() {
        vec2 ires = 1.0 / resolution;
        vec3 src = texture2D(tSrc, gl_FragCoord.xy * ires).rgb;
        vec4 e0 = texture2D(tElevation, gl_FragCoord.xy * ires);
        vec3 n0 = texture2D(tNormal, gl_FragCoord.xy * ires).rgb;
        vec2 sr = normalize(sunDirection.xy);
        vec2 p0 = gl_FragCoord.xy;
        vec2 p = floor(p0);
        vec2 stp = sign(sr);
        vec2 tMax = step(0.0, sr) * (1.0 - fract(p0)) + (1.0 - step(0.0, sr)) * fract(p0);
        tMax /= abs(sr);
        vec2 tDelta = 1.0 / abs(sr);
        for (int i = 0; i < 65536; i++) {
          if (tMax.x < tMax.y) {
            tMax.x += tDelta.x;
            p.x += stp.x;
          } else {
            tMax.y += tDelta.y;
            p.y += stp.y;
          }
          vec2 ptex = ires * (p + 0.5);
          if (ptex.x < 0.0 || ptex.x > 1.0 || ptex.y < 0.0 || ptex.y > 1.0) {
            gl_FragColor = vec4(src + vec3(1.0/128.0) * clamp(dot(n0, sunDirection), 0.0, 1.0), 1.0);
            return;
          }
          vec4 e = texture2D(tElevation, ptex);
          float t = distance(p + 0.5, p0);
          float z = e0.r + t * pixelScale * sunDirection.z;
          if (e.r > z) {
            gl_FragColor = vec4(src, 1.0);
            return;
          }
        }
        gl_FragColor = vec4(src + vec3(1.0/128.0) * clamp(dot(n0, sunDirection), 0.0, 1.0), 1.0);
      }
    `,
    depth: {
      enable: false
    },
    attributes: {
      position: [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]
    },
    uniforms: {
      tElevation: fboElevation,
      tNormal: fboNormal,
      tSrc: regl.prop("src"),
      sunDirection: regl.prop("sunDirection"),
      pixelScale: pixelScale,
      resolution: [image.width, image.height]
    },
    viewport: { x: 0, y: 0, width: image.width, height: image.height },
    framebuffer: regl.prop("dest"),
    count: 6
  });

  for (let i = 0; i < 128; i++) {
    cmdSoftShadows({
      sunDirection: vec3.normalize(
        [],
        vec3.add(
          [],
          vec3.scale([], vec3.normalize([], [1, 1, 0.5]), 149600000000),
          vec3.random([], 695508000 * 100)
        )
      ),
      src: shadowPP.ping(),
      dest: shadowPP.pong()
    });
    shadowPP.swap();
  }

  const ambientPP = demo.PingPong(regl, {
    width: image.width,
    height: image.height,
    colorType: "float"
  });

  const cmdAmbient = regl({
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
      uniform sampler2D tNormal;
      uniform sampler2D tSrc;
      uniform vec3 direction;
      uniform vec2 resolution;
      uniform float pixelScale;

      void main() {
        vec2 ires = 1.0 / resolution;
        vec3 src = texture2D(tSrc, gl_FragCoord.xy * ires).rgb;
        vec4 e0 = texture2D(tElevation, gl_FragCoord.xy * ires);
        vec3 n0 = texture2D(tNormal, gl_FragCoord.xy * ires).rgb;
        vec3 sr3d = normalize(n0 + direction);
        vec2 sr = normalize(sr3d.xy);
        vec2 p0 = gl_FragCoord.xy;
        vec2 p = floor(p0);
        vec2 stp = sign(sr);
        vec2 tMax = step(0.0, sr) * (1.0 - fract(p0)) + (1.0 - step(0.0, sr)) * fract(p0);
        tMax /= abs(sr);
        vec2 tDelta = 1.0 / abs(sr);
        for (int i = 0; i < 65536; i++) {
          if (tMax.x < tMax.y) {
            tMax.x += tDelta.x;
            p.x += stp.x;
          } else {
            tMax.y += tDelta.y;
            p.y += stp.y;
          }
          vec2 ptex = ires * (p + 0.5);
          if (ptex.x < 0.0 || ptex.x > 1.0 || ptex.y < 0.0 || ptex.y > 1.0) {
            gl_FragColor = vec4(src + vec3(1.0/128.0), 1.0);
            return;
          }
          vec4 e = texture2D(tElevation, ptex);
          float t = distance(p + 0.5, p0);
          float z = e0.r + t * pixelScale * sr3d.z;
          if (e.r > z) {
            gl_FragColor = vec4(src, 1.0);
            return;
          }
        }
        gl_FragColor = vec4(src + vec3(1.0/128.0), 1.0);
      }
    `,
    depth: {
      enable: false
    },
    attributes: {
      position: [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]
    },
    uniforms: {
      tElevation: fboElevation,
      tNormal: fboNormal,
      tSrc: regl.prop("src"),
      direction: regl.prop("direction"),
      pixelScale: pixelScale,
      resolution: [image.width, image.height]
    },
    viewport: { x: 0, y: 0, width: image.width, height: image.height },
    framebuffer: regl.prop("dest"),
    count: 6
  });

  for (let i = 0; i < 128; i++) {
    cmdAmbient({
      direction: vec3.random([], Math.random()),
      src: ambientPP.ping(),
      dest: ambientPP.pong()
    });
    ambientPP.swap();
  }

  // Download the terrain-rgb region.
  const satelliteImage = await demo.getRegion(
    tLat,
    tLong,
    zoom,
    `https://api.mapbox.com/v4/mapbox.satellite/zoom/tLong/tLat.pngraw?access_token=${MAPBOX_KEY}`
  );

  // Create a texture from the satellite tile.
  const tSatellite = regl.texture({
    data: satelliteImage,
    flipY: true
  });

  const cmdFinal = regl({
    vert: `
      precision highp float;
      attribute vec2 position;

      void main() {
        gl_Position = vec4(position, 0, 1);
      }
    `,
    frag: `
      precision highp float;

      uniform sampler2D tSoftShadow;
      uniform sampler2D tAmbient;
      uniform sampler2D tSatellite;
      uniform vec2 resolution;

      void main() {
        vec2 ires = 1.0 / resolution;
        float softShadow = texture2D(tSoftShadow, ires * gl_FragCoord.xy).r;
        float ambient = texture2D(tAmbient, ires * gl_FragCoord.xy).r;
        vec3 satellite = texture2D(tSatellite, ires * gl_FragCoord.xy).rgb;
        float l = 4.0 * softShadow + 0.25 * ambient;
        vec3 color = l * pow(satellite, vec3(2.0));
        color = pow(color, vec3(1.0/2.2));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depth: {
      enable: false
    },
    attributes: {
      position: [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]
    },
    uniforms: {
      tSoftShadow: shadowPP.ping(),
      tAmbient: ambientPP.ping(),
      tSatellite: tSatellite,
      resolution: [image.width, image.height]
    },
    viewport: { x: 0, y: 0, width: image.width, height: image.height },
    count: 6
  });

  cmdFinal();
}

main();
