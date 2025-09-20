const path = require('path');

module.exports = {
  entry: {
    solanaAuth: './src/SolanaAuth.jsx', // твой React-компонент
  },
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: '[name].bundle.js',
    library: 'SolanaAuth',      // 👈 глобальная переменная: window.SolanaAuth
    libraryTarget: 'var',
    globalObject: 'this',       // работает и в браузере, и в Node
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react'
            ],
          },
        },
      },
      {
        test: /\.css$/i, // для стилей из @solana/wallet-adapter-react-ui
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: 'source-map', // полезно для отладки
};
