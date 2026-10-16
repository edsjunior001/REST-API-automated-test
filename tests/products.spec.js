const { expect, responseBody, test } = require('./fixtures')
const { makeProduct, makeUnknownId } = require('../src/test-data')

test.describe('Products - /produtos', () => {
  test('lists products, supports name filtering and returns no-match results', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const product = await testData.createProduct(admin)

    const foundResponse = await api.request(
      'GET',
      `/produtos?nome=${encodeURIComponent(product.nome)}`
    )
    expect(foundResponse.status()).toBe(200)
    const foundBody = await responseBody(foundResponse)
    expect(foundBody.quantidade).toBe(1)
    expect(foundBody.produtos[0]).toMatchObject({
      _id: product.id,
      nome: product.nome,
      preco: product.preco,
      quantidade: product.quantidade
    })

    const noMatchResponse = await api.request(
      'GET',
      `/produtos?nome=${encodeURIComponent(`missing-${Date.now()}`)}`
    )
    expect(noMatchResponse.status()).toBe(200)
    expect(await responseBody(noMatchResponse)).toMatchObject({
      quantidade: 0,
      produtos: []
    })
  })

  test('gets a product by ID and rejects an unknown ID', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const product = await testData.createProduct(admin)

    const foundResponse = await api.request('GET', `/produtos/${product.id}`)
    expect(foundResponse.status()).toBe(200)
    expect(await responseBody(foundResponse)).toMatchObject({
      _id: product.id,
      nome: product.nome
    })

    const missingResponse = await api.request('GET', `/produtos/${makeUnknownId('product')}`)
    expect(missingResponse.status()).toBe(400)
  })

  test('allows an administrator to create a product', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const product = await testData.createProduct(admin)

    const response = await api.request('GET', `/produtos/${product.id}`)
    expect(response.status()).toBe(200)
    expect(await responseBody(response)).toMatchObject({
      _id: product.id,
      preco: product.preco,
      quantidade: product.quantidade
    })
  })

  test('rejects product creation without a token or with a standard-user token', async ({ api, testData }) => {
    const user = await testData.createUser({ admin: false })
    const productData = {
      nome: `Unauthorized ${Date.now()}`,
      preco: 100,
      descricao: 'Authorization negative case',
      quantidade: 1
    }

    const missingTokenResponse = await api.request('POST', '/produtos', {
      data: productData
    })
    expect(missingTokenResponse.status()).toBe(401)

    const standardUserResponse = await api.request('POST', '/produtos', {
      data: { ...productData, nome: `${productData.nome} standard` },
      token: user.token
    })
    expect(standardUserResponse.status()).toBe(403)

    const invalidTokenResponse = await api.request('POST', '/produtos', {
      data: { ...productData, nome: `${productData.nome} invalid` },
      token: 'Bearer invalid-token'
    })
    expect(invalidTokenResponse.status()).toBe(401)

    const lookup = await api.request(
      'GET',
      `/produtos?nome=${encodeURIComponent(productData.nome)}`
    )
    expect(lookup.status()).toBe(200)
    expect(await responseBody(lookup)).toMatchObject({ quantidade: 0, produtos: [] })
  })

  test('rejects standard-user and unauthenticated product updates/deletes', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin)
    const updated = {
      nome: `Unauthorized update ${Date.now()}`,
      preco: product.preco,
      descricao: product.descricao,
      quantidade: product.quantidade
    }

    const missingTokenUpdate = await api.request('PUT', `/produtos/${product.id}`, {
      data: updated
    })
    expect(missingTokenUpdate.status()).toBe(401)

    const standardUserUpdate = await api.request('PUT', `/produtos/${product.id}`, {
      data: updated,
      token: user.token
    })
    expect(standardUserUpdate.status()).toBe(403)

    const missingTokenDelete = await api.request('DELETE', `/produtos/${product.id}`)
    expect(missingTokenDelete.status()).toBe(401)

    const standardUserDelete = await api.request('DELETE', `/produtos/${product.id}`, {
      token: user.token
    })
    expect(standardUserDelete.status()).toBe(403)

    const getResponse = await api.request('GET', `/produtos/${product.id}`)
    expect(await responseBody(getResponse)).toMatchObject({
      _id: product.id,
      nome: product.nome
    })
  })

  test('rejects a duplicate product name', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const product = await testData.createProduct(admin)

    const response = await api.request('POST', '/produtos', {
      data: {
        nome: product.nome,
        preco: product.preco,
        descricao: product.descricao,
        quantidade: product.quantidade
      },
      token: admin.token
    })

    expect(response.status()).toBe(400)
    expect((await responseBody(response)).message).toBeTruthy()
  })

  test('rejects zero/negative prices and negative stock quantities', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const invalidProducts = [
      makeProduct({ nome: `QA zero price ${Date.now()}`, preco: 0 }),
      makeProduct({ nome: `QA negative price ${Date.now()}`, preco: -1 }),
      makeProduct({ nome: `QA negative stock ${Date.now()}`, quantidade: -1 })
    ]

    for (const product of invalidProducts) {
      const response = await api.request('POST', '/produtos', {
        data: product,
        token: admin.token
      })
      if (response.status() === 201) {
        const created = await responseBody(response)
        testData.trackProduct(created._id, admin)
      }
      expect(response.status()).toBe(400)
    }
  })

  test('allows a product with zero stock but makes it unavailable to cart quantity checks', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin, { quantidade: 0 })

    const response = await testData.createCart(user, [
      { idProduto: product.id, quantidade: 1 }
    ])

    expect(response.status()).toBe(400)
    const productResponse = await api.request('GET', `/produtos/${product.id}`)
    expect((await responseBody(productResponse)).quantidade).toBe(0)
  })

  test('updates an existing product and persists the changes', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const product = await testData.createProduct(admin)
    const updated = {
      nome: `Updated ${product.nome}`,
      preco: 245,
      descricao: product.descricao,
      quantidade: product.quantidade
    }

    const updateResponse = await api.request('PUT', `/produtos/${product.id}`, {
      data: updated,
      token: admin.token
    })
    expect(updateResponse.status()).toBe(200)

    const getResponse = await api.request('GET', `/produtos/${product.id}`)
    expect(getResponse.status()).toBe(200)
    expect(await responseBody(getResponse)).toMatchObject({
      _id: product.id,
      nome: updated.nome,
      preco: updated.preco
    })
  })

  test('creates a product when PUT targets an unknown ID', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const id = makeUnknownId('put-product')
    const product = {
      nome: `PUT-created ${Date.now()}`,
      preco: 180,
      descricao: 'Created through documented PUT behavior',
      quantidade: 7
    }

    const response = await api.request('PUT', `/produtos/${id}`, {
      data: product,
      token: admin.token
    })
    const created = await responseBody(response)
    if (typeof created._id === 'string') testData.trackProduct(created._id, admin)
    expect(response.status()).toBe(201)
    expect(created._id).toEqual(expect.any(String))

    const getResponse = await api.request('GET', `/produtos/${created._id}`)
    expect(getResponse.status()).toBe(200)
    expect(await responseBody(getResponse)).toMatchObject({
      _id: created._id,
      nome: product.nome
    })
  })

  test('deletes a product that is not in a cart', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const product = await testData.createProduct(admin)

    const deleteResponse = await api.request('DELETE', `/produtos/${product.id}`, {
      token: admin.token
    })
    expect(deleteResponse.status()).toBe(200)

    const getResponse = await api.request('GET', `/produtos/${product.id}`)
    expect(getResponse.status()).toBe(400)
  })

  test('prevents deleting a product that is in a cart', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin)
    const cartResponse = await testData.createCart(user, [
      { idProduto: product.id, quantidade: 1 }
    ])
    expect(cartResponse.status()).toBe(201)

    const deleteResponse = await api.request('DELETE', `/produtos/${product.id}`, {
      token: admin.token
    })
    expect(deleteResponse.status()).toBe(400)
    expect((await responseBody(deleteResponse)).message).toBeTruthy()
  })
})
