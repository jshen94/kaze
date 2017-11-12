const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

module.exports = {
    entry: {
        'duel-zone': './src/duel-zone/index.tsx',
        'map-editor': './src/map-editor/index.tsx'
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    devtool: 'source-map',
    plugins: [
        new CleanWebpackPlugin(['dist']),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            chunks: ['duel-zone'],
            template: path.resolve(__dirname, 'src/duel-zone/template.html')
        }),
        new HtmlWebpackPlugin({
           filename: 'editor.html',
            chunks: ['map-editor'],
            template: path.resolve(__dirname, 'src/map-editor/template.html')
        })
    ],
    resolve: {
        extensions: ['.js', '.json', '.ts', '.tsx']
    },
    module: {
        rules: [
            {test: /\.css$/, use: ['style-loader', 'css-loader']},
            {test: /\.(jpeg|png|gif|svg|ttf|eot|woff|woff2)$/, loader: 'file-loader'},
            {test: /\.tsx?$/, loader: 'awesome-typescript-loader'},
            {enforce: 'pre', test: /\.js$/, loader: 'source-map-loader'}
        ]
    }
};
