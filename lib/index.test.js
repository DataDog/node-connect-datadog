const connectDatadog = require("./index");

const mockStatsDImplementation = {
  histogram: jest.fn(),
  increment: jest.fn(),
}

jest.mock('hot-shots', () => ({
  StatsD: jest.fn().mockImplementation(() => mockStatsDImplementation),
}))

describe('connectDatadog', () => {
  let req
  let res
  let next

  const chunk = '<p>Here is a chunk</p>'
  const encoding = 'text/html'

  beforeEach(() => {
    req = {
      route: { path: '/some/path' },
      path: '/another/path',
      method: 'GET',
      baseUrl: 'http://www.fakeurl.com',
    }
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      statusCode: 200,
    }
    next = jest.fn()
  })

  afterEach(() => {
    mockStatsDImplementation.histogram.mockReset()
    mockStatsDImplementation.increment.mockReset()
  })

  const asyncConnectDatadogAndCallMiddleware = (options, timeoutInterval = 0) =>
    new Promise(resolve => {
      const middleware = connectDatadog(options)
      middleware(req, res, next)

      timeoutInterval > 0
        ? setTimeout(() => resolve(res.end(chunk, encoding)), timeoutInterval)
        : (res.end(chunk, encoding), resolve())
    })

  const expectConnectedToDatadog = (stat, statTags, exactMatch = true) => {
    const checkStatTags = exactMatch
      ? statTags
      : expect.arrayContaining(statTags)

    expect(mockStatsDImplementation.histogram).toHaveBeenCalledWith(
      `${stat}.response_time`,
      expect.anything(),
      1,
      checkStatTags
    )
    expect(mockStatsDImplementation.increment).toHaveBeenCalledWith(
      `${stat}.response_code.${res.statusCode}`,
      1,
      checkStatTags
    )
    expect(mockStatsDImplementation.increment).toHaveBeenCalledWith(
      `${stat}.response_code.all`,
      1,
      checkStatTags
    )
    expect(next).toHaveBeenCalled()
  }

  describe('middleware', () => {
    it('calls next', () => {
      const middleware = connectDatadog({})

      middleware(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('when res.end is called', () => {
    it('calls the original res.end', async () => {
      // connectDatadog monkey-patches res.end, so we need to test that the original one is called
      const originalEnd = res.end

      await asyncConnectDatadogAndCallMiddleware({})
      expect(originalEnd).toHaveBeenCalled()
    })

    it('should update the histogram', async () => {
      await asyncConnectDatadogAndCallMiddleware({})
      expect(mockStatsDImplementation.histogram).toHaveBeenCalled()
    })
  })

  describe('when options are passed to the closure', () => {
    describe('new dogstatsd object', () => {
      let dogstatsd

      beforeEach(() => {
        dogstatsd = { histogram: jest.fn() }
      })

      it('gets a value for the dogstatsd option', async () => {
        await asyncConnectDatadogAndCallMiddleware({ dogstatsd })
        expect(dogstatsd.histogram).toHaveBeenCalled()
      })

      it('uses the default value for the dogstatsd option if not passed', async () => {
        await asyncConnectDatadogAndCallMiddleware({})
        expect(mockStatsDImplementation.histogram).toHaveBeenCalled()
        expect(dogstatsd.histogram).not.toHaveBeenCalled()
      })
    })

    describe('stat', () => {
      describe('when the stat option is passed', () => {
        it('should send a metric name with the passed value', async () => {
          const stat = 'foo'
          const statTags = expect.anything()

          await asyncConnectDatadogAndCallMiddleware({ stat, response_code: true })
          expectConnectedToDatadog(stat, statTags)
        })
      })

      describe('when the stat option is not passed', () => {
        it('should send a metric name with the default value', async () => {
          const stat = 'node.express.router'
          const statTags = expect.anything()

          await asyncConnectDatadogAndCallMiddleware({ response_code: true })
          expectConnectedToDatadog(stat, statTags)
        })
      })
    })

    describe('tags', () => {
      describe('when the tags option is passed', () => {
        describe('when the tags option is a list of tags', () => {
          it('should append a list of tags to the metric tag', async () => {
            const stat = 'node.express.router'
            const tags = ['foo:bar', 'baz:ball']
            const statTags = [
              `route:${req.route.path}`,
              `response_code:${res.statusCode}`,
            ].concat(tags)

            await asyncConnectDatadogAndCallMiddleware({ response_code: true, tags })
            expectConnectedToDatadog(stat, statTags, false)
          })
        })
      })

      describe('when the tags option is not passed', () => {
        it('uses the default value for the tags option if not passed', async () => {
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.route.path}`,
            `response_code:${res.statusCode}`,
          ]

          await asyncConnectDatadogAndCallMiddleware({ response_code: true })
          expectConnectedToDatadog(stat, statTags)
        })
      })
    })

    describe('path', () => {
      describe('when the path option is truthy', () => {
        it('should append the path to the metric tag', async () => {
          const path = true
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.route.path}`,
            `response_code:${res.statusCode}`,
            `path:${req.path}`,
          ]

          await asyncConnectDatadogAndCallMiddleware({ response_code: true, path })
          expectConnectedToDatadog(stat, statTags, false)
        })
      })

      describe('when the path option is falsy', () => {
        it('should NOT append the path to the metric tag', async () => {
          const path = false
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.route.path}`,
            `response_code:${res.statusCode}`,
          ]

          // path option is explicitly set to false
          await asyncConnectDatadogAndCallMiddleware({ response_code: true, path })
          expectConnectedToDatadog(stat, statTags)

          // default path option is used
          await asyncConnectDatadogAndCallMiddleware({ response_code: true })
          expectConnectedToDatadog(stat, statTags)
        })
      })

      describe('when the path is not set in the request', () => {
        describe('when base_url is truthly', () => {
          it('uses the base URL as the route', async() => {
            delete req.route
            const stat = 'node.express.router'
            const statTags = [
              `route:${req.baseUrl}`,
              `response_code:${res.statusCode}`,
            ]
    
            await asyncConnectDatadogAndCallMiddleware({ base_url: true, response_code: true })
            expectConnectedToDatadog(stat, statTags, false)
            expect(next).toHaveBeenCalled()
          })
        })

        describe('when base_url is falsely', () => {
          it('route tag is not specified', async() => {
            delete req.route
            const stat = 'node.express.router'
            const statTags = [
              `response_code:${res.statusCode}`,
            ]
    
            await asyncConnectDatadogAndCallMiddleware({ response_code: true })
            expectConnectedToDatadog(stat, statTags, false)
            expect(next).toHaveBeenCalled()
          })
        })
      })
    })

    describe('base_url', () => {
      describe('when the base_url option is truthy', () => {
        it('should append the baseUrl to the beginning of the route in the metric tag', () => {
          const base_url = true
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.baseUrl}${req.route.path}`,
            `response_code:${res.statusCode}`,
          ]

          asyncConnectDatadogAndCallMiddleware({
            response_code: true,
            base_url,
          })
          expectConnectedToDatadog(stat, statTags)
        })
      })

      describe('when the base_url option is falsy', () => {
        it('should NOT append the baseUrl to the beginning of the route in the metric tag', () => {
          const base_url = false
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.route.path}`,
            `response_code:${res.statusCode}`,
          ]

          // base_url option is explicitly set to false
          asyncConnectDatadogAndCallMiddleware({
            response_code: true,
            base_url,
          })
          expectConnectedToDatadog(stat, statTags)

          // default base_url option is used
          asyncConnectDatadogAndCallMiddleware({ response_code: true })
          expectConnectedToDatadog(stat, statTags)
        })
      })
    })

    describe('response_code', () => {
      describe('when the response_code option is truthy', () => {
        it('should send metrics for the response_code', async () => {
          const response_code = true

          await asyncConnectDatadogAndCallMiddleware({ response_code })
          expect(mockStatsDImplementation.increment).toHaveBeenCalledTimes(2)
          expect(mockStatsDImplementation.histogram).toHaveBeenCalled()
        })
      })

      describe('when the response_code option is falsy', () => {
        it('should NOT send metrics for the response_code', async () => {
          const response_code = false

          // response_code option is explicitly set to false
          await asyncConnectDatadogAndCallMiddleware({ response_code })
          expect(mockStatsDImplementation.increment).not.toHaveBeenCalled()
          expect(mockStatsDImplementation.histogram).toHaveBeenCalled()

          // default response_code option is used
          await asyncConnectDatadogAndCallMiddleware({})
          expect(mockStatsDImplementation.increment).not.toHaveBeenCalled()
          expect(mockStatsDImplementation.histogram).toHaveBeenCalled()
        })
      })
    })

    describe('delim', () => {
      describe('when the route contains a pipe character', () => {
        describe('when the delim option is passed', () => {
          it('should replace the pipe character', async () => {
            const delim = 'x'
            const origRoute = '/route|with|pipe'
            const routeWithoutPipes = `/route${delim}with${delim}pipe`
            req.route.path = origRoute
            const stat = 'node.express.router'
            const statTags = [`route:${routeWithoutPipes}`]

            await asyncConnectDatadogAndCallMiddleware({ delim })
            expect(mockStatsDImplementation.histogram).toHaveBeenCalledWith(
              `${stat}.response_time`,
              expect.anything(),
              1,
              statTags
            )
          })
        })

        describe('when the delim option is NOT passed', () => {
          it('should use the default delim', async () => {
            const origRoute = '/route|with|pipe'
            const routeWithoutPipes = '/route-with-pipe' // The default delim should be '-'
            req.route.path = origRoute
            const stat = 'node.express.router'
            const statTags = [`route:${routeWithoutPipes}`]

            await asyncConnectDatadogAndCallMiddleware({})
            expect(mockStatsDImplementation.histogram).toHaveBeenCalledWith(
              `${stat}.response_time`,
              expect.anything(),
              1,
              statTags
            )
          })
        })
      })

      describe('when the route does NOT contain a pipe character', () => {
        it('should not change the route', async () => {
          const origRoute = '/route_with_pipe'
          req.route.path = origRoute
          const stat = 'node.express.router'
          const statTags = [`route:${origRoute}`]

          await asyncConnectDatadogAndCallMiddleware({})
          expect(mockStatsDImplementation.histogram).toHaveBeenCalledWith(
            `${stat}.response_time`,
            expect.anything(),
            1,
            statTags
          )
        })
      })
    })

    describe('response_time', () => {
      const TIME_TO_WAIT = 50

      it('should send a valid response_time metric greater than 0', async () => {
        await asyncConnectDatadogAndCallMiddleware({}, TIME_TO_WAIT)

        const expectedResponseTime =
          mockStatsDImplementation.histogram.mock.calls[0][1]
        expect(mockStatsDImplementation.histogram).toHaveBeenCalled()
        expect(expectedResponseTime).toBeGreaterThanOrEqual(TIME_TO_WAIT)
      })
    })

    describe('method', () => {
      describe('when the method option is truthy', () => {
        it('should append the req.method to the metric tags', async () => {
          const method = true
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.route.path}`,
            `response_code:${res.statusCode}`,
            `method:${req.method.toLowerCase()}`,
          ]

          await asyncConnectDatadogAndCallMiddleware({ response_code: true, method })
          expectConnectedToDatadog(stat, statTags, false)
        })
      })

      describe('when the method option is falsy', () => {
        it('should not append the req.method to the metric tags', async () => {
          const method = false
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.route.path}`,
            `response_code:${res.statusCode}`,
          ]

          // method option is explicitly set to false
          await asyncConnectDatadogAndCallMiddleware({ response_code: true, method })
          expectConnectedToDatadog(stat, statTags, false)

          // no method option is passed
          await asyncConnectDatadogAndCallMiddleware({ response_code: true })
          expectConnectedToDatadog(stat, statTags, false)
        })
      })
    })

    describe('protocol', () => {
      describe('when the protocol option is truthy', () => {
        it('should append req.protocol to the metric tags if req.protocol is defined', async () => {
          const protocol = true
          req.protocol = 'fake protocol'
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.route.path}`,
            `response_code:${res.statusCode}`,
            `protocol:${req.protocol}`,
          ]

          await asyncConnectDatadogAndCallMiddleware({
            response_code: true,
            protocol,
          })
          expectConnectedToDatadog(stat, statTags, false)
        })

        it('should still send metrics if req.protocol is NOT defined', async () => {
          const protocol = true
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.route.path}`,
            `response_code:${res.statusCode}`,
          ]

          await asyncConnectDatadogAndCallMiddleware({
            response_code: true,
            protocol,
          })
          expectConnectedToDatadog(stat, statTags)
        })
      })

      describe('when the protocol option is falsy', () => {
        it('should NOT append req.protocol to the metric tags if req.protocol is defined', async () => {
          const protocol = false
          req.protocol = 'fake protocol'
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.route.path}`,
            `response_code:${res.statusCode}`,
          ]

          // protocol option is explicitly set to false
          await asyncConnectDatadogAndCallMiddleware({
            response_code: true,
            protocol,
          })
          expectConnectedToDatadog(stat, statTags)

          // no protocol option is set
          await asyncConnectDatadogAndCallMiddleware({ response_code: true })
          expectConnectedToDatadog(stat, statTags)
        })

        it('should still send metrics if req.protocol is NOT defined', async () => {
          const protocol = false
          const stat = 'node.express.router'
          const statTags = [
            `route:${req.route.path}`,
            `response_code:${res.statusCode}`,
          ]

          // protocol option is explicitly set to false
          await asyncConnectDatadogAndCallMiddleware({
            response_code: true,
            protocol,
          })
          expectConnectedToDatadog(stat, statTags)

          // no protocol option is set
          await asyncConnectDatadogAndCallMiddleware({ response_code: true })
          expectConnectedToDatadog(stat, statTags)
        })
      })
    })
  })
})
