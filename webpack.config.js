'use strict';
/* eslint-env node */
var path = require('path'),
    webpack = require('webpack');

module.exports = {
  // split libraries into multiple chunks for more readable compiled code
  entry: {
    util: ['./util.js'],
    TuringMachine: ['./TuringMachine.js'],
    TapeViz: ['./tape/TapeViz.js'],
    StateViz: ['./StateViz.js'],
    main: './main.js'
  },
  output: {
    library: '[name]', // allow console interaction
    path: path.join(__dirname, 'build'),
    filename: '[name].bundle.js',
    pathinfo: true
  },
  externals: {
    'd3': 'd3',
    'lodash': 'lodash',
    'lodash/fp': '_',
    'js-yaml': 'jsyaml',
    'ace-builds/src-min-noconflict': 'ace',
    'jquery': 'jQuery'
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      // Note on ordering:
      // Each "commons chunk" takes modules shared with any previous chunks,
      // including other commons. Later commons therefore contain the fewest dependencies.
      // For clarity, reverse this to be consistent with browser include order.
      names: ['util', 'TuringMachine', 'TapeViz', 'StateViz'].reverse()
    })
  ],
  module: {
    loaders: [
      // ./Examples.js uses ES6 template literals for multiline strings
      { test: /\/Examples\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          plugins: ['babel-plugin-transform-es2015-template-literals', 'transform-strict-mode']
        },
        cacheDirectory: true
      }
    ]
  }
};
