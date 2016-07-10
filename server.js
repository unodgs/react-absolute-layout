const http = require("http");
const path = require("path");
const express = require("express");
const fs = require('fs');

const app = express();
app.set('port', 3000);
app.use(express.static(path.join(__dirname, './'), { 'maxAge': '14d' }));


app.get('/admin*', (req, res) => {
    res.sendFile(path.join(__dirname, './build/admin.html'));
});

app.use('/', (req, res) => {
    res.sendFile(path.join(__dirname, './index.html'));
});

var createServer = function() {
    http.createServer(app).listen(app.get('port'), function() {
        console.log("Express server listening on port " + app.get('port'));
    });
};

createServer();
