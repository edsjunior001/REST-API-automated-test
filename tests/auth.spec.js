const { expect, responseBody, test } = require('./fixtures')

test.describe('Authentication - POST /login', () => {
  test('authenticates a registered user and returns a usable token', async ({ api, testData }) => {
    const user = await testData.createUser({ admin: false, login: false })

    const response = await api.request('POST', '/login', {
      data: { email: user.email, password: user.password }
    })

    expect(response.status()).toBe(200)
    const body = await responseBody(response)
    expect(body.message).toBeTruthy()
    expect(body.authorization).toEqual(expect.any(String))

    const protectedResponse = await api.request('POST', '/produtos', {
      data: {
        nome: `Unauthorized-check-${user.id}`,
        preco: 100,
        descricao: 'Must not be created by a standard user',
        quantidade: 1
      },
      token: body.authorization
    })
    expect(protectedResponse.status()).toBe(403)
  })

  test('rejects an incorrect password without issuing a token', async ({ api, testData }) => {
    const user = await testData.createUser({ admin: false })

    const response = await api.request('POST', '/login', {
      data: { email: user.email, password: 'incorrect-password' }
    })

    expect(response.status()).toBe(401)
    const body = await responseBody(response)
    expect(body.authorization).toBeUndefined()
    expect(body.message).toBeTruthy()
  })

  test('rejects an unknown email', async ({ api }) => {
    const response = await api.request('POST', '/login', {
      data: {
        email: `missing.${Date.now()}@example.com`,
        password: 'irrelevant-password'
      }
    })

    expect(response.status()).toBe(401)
    expect((await responseBody(response)).authorization).toBeUndefined()
  })

  test('rejects a login request with missing credentials', async ({ api }) => {
    const response = await api.request('POST', '/login', { data: {} })

    expect(response.status()).toBe(400)
    const body = await responseBody(response)
    expect(body.email).toBeTruthy()
    expect(body.password).toBeTruthy()
  })
})
