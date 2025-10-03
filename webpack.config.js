const path = require('path');

module.exports = {
  entry: {
    SolanaAuth: './src/SolanaAuth.jsx',
    newland: './src/newland.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: '[name].bundle.js',
    library: '[name]',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "assert": require.resolve("assert"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "buffer": require.resolve("buffer"),
      "process": require.resolve("process/browser"),
      "vm": require.resolve("vm-browserify"),
    },
  },
  plugins: [
    new (require('webpack')).ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: false, // 👈 отключаем eval
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM'
  }
};