"use strict";

var path = require("path");

module.exports = {
  // temporary "entry point", until all of app is transitioned to webpack
  entry: "./Position.js",
  output: {
    library: 'Position',
    // libraryTarget: 'umd',
    path: path.join(__dirname, "build"),
    filename: "bundle.js"
  },
  externals: {
    "lodash-fp": "_"
  }
}
