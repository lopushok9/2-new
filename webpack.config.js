const path = require('path');

module.exports = {
  entry: './src/SolanaAuth.jsx',
  output: {
  path: path.resolve(__dirname, 'public/dist'),
  filename: '[name].bundle.js',
  library: 'SolanaAuth',          // имя глобальной переменной
  libraryTarget: 'umd',           // чтобы было доступно в браузере
  globalObject: 'this',
},

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM'
  }
};
