const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

// Load environment variables
require('dotenv').config();

module.exports = {
  entry: {
    'background/service-worker': './src/background/service-worker-simple.js',
    'popup/popup': './src/popup/popup.js'
  },
  output: {
    path: path.resolve(__dirname, 'chrome-extension'),
    filename: '[name].js',
    clean: false
  },
  resolve: {
    extensions: ['.js']
  },
  plugins: [
    // No need to inject private environment variables anymore
    // Firebase config is now hardcoded as public config (safe for client-side)
    new CopyPlugin({
      patterns: [
        {
          from: 'src/manifest.json',
          to: 'manifest.json'
        },
        {
          from: 'src/popup/popup.html',
          to: 'popup/popup.html'
        },
        {
          from: 'src/popup/popup.css',
          to: 'popup/popup.css'
        },
        {
          from: 'src/content_scripts',
          to: 'content_scripts'
        },
        {
          from: 'src/icons',
          to: 'icons'
        }
      ]
    })
  ],
  mode: 'production',
  optimization: {
    minimize: false // Keep readable for Chrome Web Store review
  }
};