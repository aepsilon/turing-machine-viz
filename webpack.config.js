'use strict';
/* eslint-env node, es6 */
const path = require('path');

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
  module: {
    rules: [{
      // copy files verbatim
      test: /\.css$/,
      loader: 'file-loader',
      options: {
        name: '[path][name].[ext]',
        context: srcRoot
      }
    }, {
      test: /\.yaml$/,
      loader: 'raw-loader',
      options: {
        esModule: false
      }
    }]
  },
  stats: {
    errorDetails: true
  }
};


//////////////////////
// Dev/Prod Configs //
//////////////////////

const devConfig = {
  mode: 'development',
  output: {pathinfo: true}
};

const prodConfig = {
  mode: 'production',
  devtool: 'source-map' // for the curious
};

const isProduction = (process.env.NODE_ENV === 'production');

module.exports = merge(commonConfig, isProduction ? prodConfig : devConfig);
