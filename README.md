## Purpose

This is the source for the demos on my blog post [Advanced Map Shading](https://wwwtyro.net/2019/03/21/advanced-map-shading.html).

## Installation

### Clone

with https:
    
    git clone https://github.com/wwwtyro/map-tile-lighting-demo.git

or with ssh:
  
    git clone git@github.com:wwwtyro/map-tile-lighting-demo.git

then move to the cloned repo: `cd map-tile-lighting-demo`
    
### Install dependencies
    
    npm install

### Configure your mapbox.key

* Go to [mapbox.com](https://www.mapbox.com/), create an account to get your API key.
* Create a file named `mapbox.key` and put inside it your API key: `echo "pk.XXXYYYZZZ" > mapbox.key`
    
### Run it!

Demos scripts can be launched with [`npm run` script](https://docs.npmjs.com/cli/run-script.html). See `scripts` section in `package.json` file.

    npm run load-image
    
    npm run elevation
    
    npm run normals
    
    npm run direct
    
    npm run soft-shadows
    
    npm run ambient-occlusion
    
    npm run combined-lighting
    
    npm run satellite
    
    npm run tiled
    
### Enjoy!
    
    npm run load-image
    
    > map-tile-lighting-demo@1.0.0 load-image /var/www/html
    > budo load-image-demo.js --live -- -t brfs
    
    [0000] info  Server running at http://192.168.48.2:9966/ (connect)
    [0000] info  LiveReload running
    [0001] 360ms      153KB (browserify)
    [0003] 4ms           0B GET    200 / (generated)
    [0003] 0ms           0B GET    200 /load-image-demo.js (generated)


Open up your browser at the given @IP eg `http://192.168.48.2:9966` and enjoy the demo!    