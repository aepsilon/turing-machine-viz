'use strict';
/* eslint-env node, es6 */
const path = require('path');
const webpack = require('webpack');


/////////////
// Utility //
/////////////

/**
 * Recursively merges two webpack configs.
 * Concatenates arrays, and throws an error for other conflicting values.
 */
function merge(x, y) {
  if (x == null) { return y; }
  if (y == null) { return x; }

  if (x instanceof Array && y instanceof Array) {
    return x.concat(y);
  } else if (Object.getPrototypeOf(x) === Object.prototype &&
             Object.getPrototypeOf(y) === Object.prototype) {
    // for safety, only plain objects are merged
    let result = {};
    (new Set(Object.keys(x).concat(Object.keys(y)))).forEach(function (key) {
      result[key] = merge(x[key], y[key]);
    });
    return result;
  } else {
    throw new Error(`cannot merge conflicting values:\n\t${x}\n\t${y}`);
  }
}


/////////////////
// Base Config //
/////////////////

const srcRoot = './src/';

const commonConfig = {
  entry: {
    TMViz: [srcRoot + 'TMViz.js'],
    main: srcRoot + 'main.js'
  },
  output: {
    library: '[name]',
    libraryTarget: 'var', // allow console interaction
    path: path.join(__dirname, 'build'),
    publicPath: '/build/',
    filename: '[name].bundle.js'
  },
  externals: {
    'ace-builds/src-min-noconflict': 'ace',
    'bluebird': 'Promise',
    'clipboard': 'Clipboard',
    'd3': 'd3',
    'jquery': 'jQuery',
    'js-yaml': 'jsyaml',
    'lodash': 'lodash',
    'lodash/fp': '_'
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      // Note on ordering:
      // Each "commons chunk" takes modules shared with any previous chunks,
      // including other commons. Later commons therefore contain the fewest dependencies.
      // For clarity, reverse this to be consistent with browser include order.
      // names: ['util', 'TuringMachine', 'TapeViz', 'StateViz'].reverse()
      names: ['TMViz'].reverse()
    })
  ],
  module: {
    loaders: [
      // copy files verbatim
      { test: /\.css$/,
        loader: 'file',
        query: {
          name: '[path][name].[ext]',
          context: srcRoot
        }
      }
    ]
  }
};


//////////////////////
// Dev/Prod Configs //
//////////////////////

const devConfig = {
  output: {pathinfo: true}
};

const prodConfig = {
  devtool: 'source-map', // for the curious
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(true),
    new webpack.optimize.UglifyJsPlugin({compress: {warnings: false}})
  ]
};

const isProduction = (process.env.NODE_ENV === 'production');

module.exports = merge(commonConfig, isProduction ? prodConfig : devConfig);
