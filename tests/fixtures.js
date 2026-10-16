const { test: base, expect } = require('@playwright/test')
const { ServeRestApi } = require('../src/api-client')
const { makeProduct, makeUser } = require('../src/test-data')

async function responseBody(response) {
  return response.json()
}

const test = base.extend({
  api: async ({ request }, use) => {
    await use(new ServeRestApi(request))
  },

  testData: async ({ api }, use) => {
    const users = new Map()
    const products = new Map()
    const cartOwners = new Map()

    const data = {
      async createUser({ admin = false, login = true, ...overrides } = {}) {
        const userData = makeUser({ admin, ...overrides })
        const response = await api.request('POST', '/usuarios', { data: userData })
        const body = await responseBody(response)
        if (typeof body._id === 'string') {
          users.set(body._id, { ...userData, id: body._id })
        }
        expect(response.status(), 'registering a unique test user').toBe(201)

        const { _id: id } = body
        expect(id, 'the created user ID').toEqual(expect.any(String))
        const user = { ...userData, id }
        users.set(id, user)

        if (login) await data.login(user)
        return user
      },

      async login(user) {
        const response = await api.request('POST', '/login', {
          data: { email: user.email, password: user.password }
        })
        expect(response.status(), 'logging in a test user').toBe(200)

        const { authorization } = await responseBody(response)
        expect(authorization, 'the login authorization value').toEqual(expect.any(String))
        user.token = authorization
        return user
      },

      async createProduct(admin, overrides = {}) {
        const productData = makeProduct(overrides)
        const response = await api.request('POST', '/produtos', {
          data: productData,
          token: admin.token
        })
        const body = await responseBody(response)
        if (typeof body._id === 'string') {
          products.set(body._id, { admin, id: body._id })
        }
        expect(response.status(), 'creating a unique test product').toBe(201)

        const { _id: id } = body
        expect(id, 'the created product ID').toEqual(expect.any(String))
        products.set(id, { admin, id })
        return { ...productData, id }
      },

      trackUser(id) {
        users.set(id, { id })
      },

      trackProduct(id, admin) {
        products.set(id, { admin, id })
      },

      async createCart(user, productsInCart) {
        cartOwners.set(user.id, user)
        return api.request('POST', '/carrinhos', {
          data: { produtos: productsInCart },
          token: user.token
        })
      }
    }

    await use(data)

    const cleanupErrors = []
    const cleanupRequest = async (description, operation) => {
      try {
        const response = await operation()
        if (response.status() !== 200) {
          const responseText = await response.text()
          cleanupErrors.push(
            new Error(`${description} returned HTTP ${response.status()}: ${responseText}`)
          )
        }
      } catch (error) {
        cleanupErrors.push(new Error(`${description} failed`, { cause: error }))
      }
    }

    for (const user of [...cartOwners.values()].reverse()) {
      await cleanupRequest(`cancelling carts for user ${user.id}`, () =>
        api.request('DELETE', '/carrinhos/cancelar-compra', { token: user.token })
      )
    }

    for (const product of [...products.values()].reverse()) {
      if (product.admin?.token) {
        await cleanupRequest(`deleting product ${product.id}`, () =>
          api.request('DELETE', `/produtos/${product.id}`, { token: product.admin.token })
        )
      }
    }

    for (const user of [...users.values()].reverse()) {
      await cleanupRequest(`deleting user ${user.id}`, () =>
        api.request('DELETE', `/usuarios/${user.id}`)
      )
    }

    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, 'ServeRest test data cleanup failed')
    }
  }
})

module.exports = { expect, responseBody, test }
