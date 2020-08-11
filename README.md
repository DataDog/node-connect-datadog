# DEPRECATED

**This library is deprecated and has been replaced with Datadog APM which generates the same metrics but also has many other [features](https://www.datadoghq.com/product/apm/) and [integrations](https://docs.datadoghq.com/tracing/compatibility_requirements/nodejs/#supported-integrations). We highly recommend upgrading to APM as this library will receive no further updates.**

# node-connect-datadog

Datadog middleware for Connect JS / Express

## Usage

Add middleware immediately before your router.

	app.use(require("connect-datadog")({}));
	app.use(app.router);

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
