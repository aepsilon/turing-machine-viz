"use strict";
var path = require("path"),
    webpack = require("webpack");

module.exports = {
  // temporary "entry point", until all of app is transitioned to webpack
  entry: {
    // [] workaround to depend on an entry point (https://github.com/webpack/webpack/issues/300)
    util: ["./util.js"],
    Position: ["./Position.js"],
    TapeViz: "./tape/TapeViz.js",
    StateViz: "./StateViz.js",
    TuringMachine: ["./TuringMachine.js"],
    NodesLinks: "./NodesLinks.js",
    ExampleTMs: "./Examples.js"
  },
  output: {
    library: '[name]',
    // libraryTarget: 'umd',
    path: path.join(__dirname, "build"),
    filename: "[name].bundle.js"
  },
  externals: {
    "d3": "d3",
    "lodash-fp": "_",
    "underscore": "underscore"
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      // note: keep "util" last so it contains the webpack bootstrap
      names: ["Position", "TuringMachine", "util"]
    })
  ]
}
