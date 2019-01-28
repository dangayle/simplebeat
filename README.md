# simplebeat

Uses a websocket connection to track pageviews, stores data in Redis

To test
-------

- `npm install`
- `npm .`
- open [localhost/test/1:8080](localhost/test/1:8080) and a bunch of other test pages, just change the number at the end
- Watch console

Example output:
---------------

```
Users online: 13
{ 'http://localhost:8080/test/123/': '4',
  'http://localhost:8080/test/4779': '3',
  'http://localhost:8080/test/4777': '3',
  'http://localhost:8080/test/3/': '1',
  'http://localhost:8080/test/13/': '1' }
```

TODO
----

- [ ] Better/more exception handling
- [ ] Better output via websocket and/or json
- [ ] Authentication
- [ ] Secure https websocket connection
