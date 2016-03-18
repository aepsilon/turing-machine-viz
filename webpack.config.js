'use strict';
/* eslint-env node */
var path = require('path'),
    webpack = require('webpack');

var srcRoot = './src/';

module.exports = {
  // split libraries into multiple chunks for more readable compiled code
  entry: {
    TMViz: [srcRoot + 'TMViz.js'],
    CheckboxTable: [srcRoot + 'sharing/CheckboxTable.js'],
    main: srcRoot + 'main.js'
  },
  output: {
    library: '[name]', // allow console interaction
    path: path.join(__dirname, 'build'),
    filename: '[name].bundle.js',
    pathinfo: true
  },
  externals: {
    'ace-builds/src-min-noconflict': 'ace',
    'bluebird': 'Promise',
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
      // ./Examples.js uses ES6 template literals for multiline strings
      { test: /\/Examples\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          plugins: ['babel-plugin-transform-es2015-template-literals', 'transform-strict-mode']
        },
        cacheDirectory: true
      },
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
