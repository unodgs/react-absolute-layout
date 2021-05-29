const HtmlPlugin = require('html-webpack-plugin')
const join = require('path').join

const stats = {
    chunks: false,
    modules: false,
}

module.exports = [{
    entry: './src/main.tsx',
    output: {
        filename: 'main.js',
        path: join(__dirname, 'bundle'),
        publicPath: '/',
    },
    devtool: "source-map",
    plugins: [
        new HtmlPlugin({
            template: './index.html',
        })
    ],
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".json"]
    },
    module: {
        rules: [{
            test: /\.css$/,
            use: ["style-loader", "css-loader"]
        }, {
            test: /\.ts(x?)$/,
            loader: 'awesome-typescript-loader',
            exclude: /node_modules/
        }, {
            enforce: "pre",
            test: /\.js$/,
            loader: "source-map-loader"
        }],
    },
    // externals: {
    //     "react": "React",
    //     "react-dom": "ReactDOM"
    // },
    devServer: {
        stats,
        port: 8077
    }
}]