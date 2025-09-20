const path = require('path');

module.exports = {
  entry: {
    solanaAuth: './src/SolanaAuth.jsx',
  },
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: '[name].bundle.js',
    library: 'SolanaAuth',
    libraryTarget: 'var',   // прямое объявление var SolanaAuth = ...
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: false, // 👈 отключаем eval
};
