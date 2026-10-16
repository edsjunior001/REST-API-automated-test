class ServeRestApi {
  constructor(requestContext) {
    this.requestContext = requestContext
  }

  request(method, path, { data, token, headers = {} } = {}) {
    const requestHeaders = { ...headers }
    if (token) requestHeaders.authorization = token

    return this.requestContext.fetch(path, {
      method,
      data,
      headers: requestHeaders,
      failOnStatusCode: false
    })
  }
}

module.exports = { ServeRestApi }
