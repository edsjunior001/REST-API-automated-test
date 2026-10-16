const { expect, responseBody, test } = require('./fixtures')
const { makeUnknownId } = require('../src/test-data')

test.describe('Carts - /carrinhos', () => {
  test('creates a cart for the authenticated user and decrements stock', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin, { quantidade: 8 })

    const response = await testData.createCart(user, [
      { idProduto: product.id, quantidade: 3 }
    ])
    expect(response.status()).toBe(201)
    const created = await responseBody(response)

    const productResponse = await api.request('GET', `/produtos/${product.id}`)
    expect(productResponse.status()).toBe(200)
    expect((await responseBody(productResponse)).quantidade).toBe(5)

    const cartResponse = await api.request('GET', `/carrinhos/${created._id}`)
    expect(cartResponse.status()).toBe(200)
    expect(await responseBody(cartResponse)).toMatchObject({
      _id: created._id,
      idUsuario: user.id,
      quantidadeTotal: 3,
      produtos: [{ idProduto: product.id, quantidade: 3, precoUnitario: product.preco }]
    })
  })

  test('lists carts and filters them by user ID', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin)
    const cartResponse = await testData.createCart(user, [
      { idProduto: product.id, quantidade: 1 }
    ])
    expect(cartResponse.status()).toBe(201)
    const { _id: cartId } = await responseBody(cartResponse)

    const listResponse = await api.request(
      'GET',
      `/carrinhos?idUsuario=${encodeURIComponent(user.id)}`
    )
    expect(listResponse.status()).toBe(200)
    const body = await responseBody(listResponse)
    expect(body.quantidade).toBe(1)
    expect(body.carrinhos).toHaveLength(1)
    expect(body.carrinhos[0]).toMatchObject({
      _id: cartId,
      idUsuario: user.id
    })
  })

  test('rejects a second cart for the same user without changing stock', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin, { quantidade: 6 })
    const items = [{ idProduto: product.id, quantidade: 2 }]

    const firstResponse = await testData.createCart(user, items)
    expect(firstResponse.status()).toBe(201)
    const secondResponse = await testData.createCart(user, items)
    expect(secondResponse.status()).toBe(400)

    const productResponse = await api.request('GET', `/produtos/${product.id}`)
    expect((await responseBody(productResponse)).quantidade).toBe(4)
  })

  test('rejects duplicate product items without changing stock', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin, { quantidade: 6 })

    const response = await testData.createCart(user, [
      { idProduto: product.id, quantidade: 1 },
      { idProduto: product.id, quantidade: 2 }
    ])
    expect(response.status()).toBe(400)

    const productResponse = await api.request('GET', `/produtos/${product.id}`)
    expect((await responseBody(productResponse)).quantidade).toBe(6)
  })

  test('rejects an unknown product and leaves stock unchanged', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin, { quantidade: 4 })

    const response = await testData.createCart(user, [
      { idProduto: makeUnknownId('product'), quantidade: 1 }
    ])
    expect(response.status()).toBe(400)

    const productResponse = await api.request('GET', `/produtos/${product.id}`)
    expect((await responseBody(productResponse)).quantidade).toBe(4)
  })

  test('rejects a quantity above available stock without decrementing it', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin, { quantidade: 2 })

    const response = await testData.createCart(user, [
      { idProduto: product.id, quantidade: 3 }
    ])
    expect(response.status()).toBe(400)

    const productResponse = await api.request('GET', `/produtos/${product.id}`)
    expect((await responseBody(productResponse)).quantidade).toBe(2)
  })

  test('rejects zero and negative cart quantities without changing stock', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const product = await testData.createProduct(admin, { quantidade: 5 })

    for (const quantity of [0, -1]) {
      const user = await testData.createUser({ admin: false })
      const response = await testData.createCart(user, [
        { idProduto: product.id, quantidade: quantity }
      ])
      expect(response.status()).toBe(400)
    }

    const productResponse = await api.request('GET', `/produtos/${product.id}`)
    expect((await responseBody(productResponse)).quantidade).toBe(5)
  })

  test('cancels a cart, removes it and restores stock', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin, { quantidade: 5 })
    const cartResponse = await testData.createCart(user, [
      { idProduto: product.id, quantidade: 2 }
    ])
    expect(cartResponse.status()).toBe(201)
    const { _id: cartId } = await responseBody(cartResponse)

    const cancelResponse = await api.request('DELETE', '/carrinhos/cancelar-compra', {
      token: user.token
    })
    expect(cancelResponse.status()).toBe(200)

    const productResponse = await api.request('GET', `/produtos/${product.id}`)
    expect((await responseBody(productResponse)).quantidade).toBe(5)
    const getCartResponse = await api.request('GET', `/carrinhos/${cartId}`)
    expect(getCartResponse.status()).toBe(400)
  })

  test('completes a cart, removes it and does not restore stock', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin, { quantidade: 5 })
    const cartResponse = await testData.createCart(user, [
      { idProduto: product.id, quantidade: 2 }
    ])
    expect(cartResponse.status()).toBe(201)
    const { _id: cartId } = await responseBody(cartResponse)

    const completeResponse = await api.request('DELETE', '/carrinhos/concluir-compra', {
      token: user.token
    })
    expect(completeResponse.status()).toBe(200)

    const productResponse = await api.request('GET', `/produtos/${product.id}`)
    expect((await responseBody(productResponse)).quantidade).toBe(3)
    const getCartResponse = await api.request('GET', `/carrinhos/${cartId}`)
    expect(getCartResponse.status()).toBe(400)
  })

  test('rejects cart creation and purchase actions without valid authentication', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const product = await testData.createProduct(admin)
    const payload = { produtos: [{ idProduto: product.id, quantidade: 1 }] }

    const noTokenResponse = await api.request('POST', '/carrinhos', { data: payload })
    expect(noTokenResponse.status()).toBe(401)
    const invalidTokenResponse = await api.request('POST', '/carrinhos', {
      data: payload,
      token: 'Bearer invalid-token'
    })
    expect(invalidTokenResponse.status()).toBe(401)

    const cancelResponse = await api.request('DELETE', '/carrinhos/cancelar-compra')
    expect(cancelResponse.status()).toBe(401)
    const completeResponse = await api.request('DELETE', '/carrinhos/concluir-compra', {
      token: 'Bearer invalid-token'
    })
    expect(completeResponse.status()).toBe(401)

    const productResponse = await api.request('GET', `/produtos/${product.id}`)
    expect((await responseBody(productResponse)).quantidade).toBe(product.quantidade)
  })

  test('rejects a nonexistent cart ID', async ({ api }) => {
    const response = await api.request('GET', `/carrinhos/${makeUnknownId('cart')}`)
    expect(response.status()).toBe(400)
    expect((await responseBody(response)).message).toBeTruthy()
  })
})
