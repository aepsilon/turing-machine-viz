"use strict";
var path = require("path"),
    webpack = require("webpack");

module.exports = {
  // split libraries into multiple chunks for more readable compiled code
  entry: {
    util: ["./util.js"],
    TuringMachine: ["./TuringMachine.js"],
    TapeViz: ["./tape/TapeViz.js"],
    StateViz: ["./StateViz.js"],
    main: "./main.js"
  },
  output: {
    path: path.join(__dirname, "build"),
    filename: "[name].bundle.js"
  },
  externals: {
    "d3": "d3",
    "lodash-fp": "_",
    "underscore": "underscore",
    "./watch.js": "watch"
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      // Note on ordering:
      // Each "commons chunk" takes modules shared with any previous chunks,
      // including other commons. Later commons therefore contain the fewest dependencies.
      // For clarity, reverse this to be consistent with browser include order.
      names: ["util", "TuringMachine", "TapeViz", "StateViz"].reverse()
    })
  ]
}
