const http = require("http"),
    express = require("express"),
    ws = require("ws"),
    redis = require("redis"),
    _ = require("lodash");

const app = express(),
    server = http.Server(app),
    wss = new ws.Server({
        server: server,
        path: "/",
        clientTracking: false,
        maxPayload: 1024
    }),
    config = {
        port: 8080,
        wshost: "ws://localhost:8080"
    },
    client = redis.createClient();

// Redis keys
const users = "users",
    userCount = "userCount",
    urls = "urls";

wss.on("connection", (ws, req) => {
    // Set redis key
    const id = `user-${req.headers["sec-websocket-key"]}`;

    // Set user/page information
    let user = {
        id: id,
        host: req.headers.host,
        ip: req.headers["x-real-ip"] || req.connection.remoteAddress,
        ua: req.headers["user-agent"],
        date: Date.now(),
        updated: Date.now()
    };

    // Add user to Redis, increment userCount
    ws.on("message", msg => {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            return;
        }

        switch (msg.type) {
            case "init":
                // get referrer and url info from init
                user.url = msg.url;
                user.referrer = msg.referrer;
                break;
        }
        user.updated = Date.now();

        //Add user hash, increment counting stats
        client.hmset(id, user, (err, result) => {
            // Increments count of sorted set item
            client.zincrby(urls, 1, user.url);
            // Add user to list of users
            client.sadd(users, id);
            // Increment userCount
            client.incr(userCount);
        });
    });

    // On close, delete user, decrement counting stats
    ws.once("close", () => {
        client.del(id, (err, result) => {
            client.zincrby(urls, -1, user.url);
            client.srem(users, id);
            client.decr(userCount);
        });
    });
});

wss.on("error", err => console.error(err));

app.get("/analytics.js", (req, res) => {
    let js = `
    var ws = new WebSocket('${config.wshost}');
    ws.onopen = function () {
        ws.send(JSON.stringify({
            type: 'init',
            url: document.location.href,
            referrer: document.referrer
        }));
    };`;

    res.set("Content-Type", "application/javascript");
    res.send(js);
});
app.get("/test/*", (req, res) => {
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
        console.log(`Users online: ${result}`);
    });

    client.zrevrange("urls", 0, 4, "withscores", (err, result) => {
        // split list into groups of two
        // See also : https://stackoverflow.com/a/52202757/250241
        result = _.fromPairs(_.chunk(result, 2));
        console.log(result);
    });
}, 10 * 1000);

app.disable("x-powered-by");
server.listen(config.port);
