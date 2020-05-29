# node-connect-datadog

Datadog middleware for Connect JS / Express


## Usage

Add middleware immediately before your router.

```javascript
app.use(require("connect-datadog")({}));
app.use(app.router);
```

You can add specific tags in other middlewares:

```javascript
const someMiddleware = (req, res, next) => {
	req.ddTags = ['foo:bar']
	next()
}
```

## Options

All options are optional.

* `dogstatsd` node-dogstatsd client. `default = new require("node-dogstatsd").StatsD()`
* `stat` *string* name for the stat. `default = "node.express.router"`
* `tags` *array* of tags to be added to the histogram. `default = []`
* `path` *boolean* include path tag. `default = false`
* `base_url` *boolean* include baseUrl. `default = false`
* `method` *boolean* include http method tag. `default = false`
* `protocol` *boolean* include protocol tag. `default = false`
* `response_code` *boolean* include http response codes. `default = false`
* `delim` *string* char to replace pipe char with in the route `default = '-'`

## License

View the [LICENSE](https://github.com/AppPress/node-connect-datadog/blob/master/LICENSE) file.
