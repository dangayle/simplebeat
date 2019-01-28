const http = require('http'),
    express = require('express'),
    ws = require('ws'),
    redis = require("redis");

const app = express(),
    server = http.Server(app),
    wss = new ws.Server({
        server: server,
        path: '/',
        clientTracking: false,
        maxPayload: 1024
    }),
    config = {
        port: 8080,
        wshost: 'ws://localhost:8080'
    },
    client = redis.createClient();

const users = 'users',
    userCount = 'userCount',
    userLastID = 'userLastID';


wss.on('connection', (ws, req) => {

    // Set redis key
    let id = `user-${req.headers['sec-websocket-key']}`;

    // Set user/page information
    let user = {
        id: id,
        host: req.headers.host,
        ip: req.headers['x-real-ip'] || req.connection.remoteAddress,
        ua: req.headers['user-agent'],
        date: Date.now(),
        updated: Date.now()
    };

    // Add user to Redis, increment userCount
    ws.on('message', msg => {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            return;
        }

        switch (msg.type) {
            case 'init':
                user.url = msg.url;
                user.ref = msg.ref;
                break;
        }
        user.updated = Date.now();
        client.hmset(id, user, (err, result) => {
            client.sadd(users, id);
            client.incr(userCount);
        });
    });

    // On close, delete user, decrement userCount
    ws.once('close', () => {
        client.del(id, (err, result) => {
            console.log(err);
            console.log(result);
            client.srem(users, id);
            client.decr(userCount);
        });
    });
});

wss.on('error', err => console.error(err));


app.get('/analytics.js', (req, res) => {
    let js = `
    var ws = new WebSocket('${config.wshost}');
    ws.onopen = function () {
        ws.send(JSON.stringify({
            type: 'init',
            url: document.location.href,
            ref: document.referrer
        }));
    };`;

    res.set('Content-Type', 'application/javascript');
    res.send(js);
});
app.get('/test/*', (req, res) => {
    let html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Test</title>
      </head>
      <body>
        <h1>Test</h1>
        <p><a href="/test/123/">Test referrer</a></p>
        <script src="/analytics.js" async></script>
      </body>
      </html>`;

    res.send(html);
});


setInterval(() => {
    client.get(userCount, (err, result) => {
        console.log(`Users online: ${ result }`)
    });
}, 10 * 1000);

app.disable('x-powered-by');
server.listen(config.port);
