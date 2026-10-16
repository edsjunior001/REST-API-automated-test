const { expect, responseBody, test } = require('./fixtures')
const { makeUnknownId } = require('../src/test-data')

test.describe('Users - /usuarios', () => {
  test('lists users and filters by a unique email', async ({ api, testData }) => {
    const user = await testData.createUser({ admin: false })

    const response = await api.request(
      'GET',
      `/usuarios?email=${encodeURIComponent(user.email)}`
    )

    expect(response.status()).toBe(200)
    const body = await responseBody(response)
    expect(body.quantidade).toBe(1)
    expect(body.usuarios).toHaveLength(1)
    expect(body.usuarios[0]).toMatchObject({
      _id: user.id,
      nome: user.nome,
      email: user.email,
      administrador: 'false'
    })
  })

  test('returns 200 and an empty collection for a filter with no matches', async ({ api }) => {
    const response = await api.request(
      'GET',
      `/usuarios?email=${encodeURIComponent(`missing.${Date.now()}@example.com`)}`
    )

    expect(response.status()).toBe(200)
    const body = await responseBody(response)
    expect(body.quantidade).toBe(0)
    expect(body.usuarios).toEqual([])
  })

  test('stores a user name containing Unicode and punctuation', async ({ api, testData }) => {
    const user = await testData.createUser({
      admin: false,
      nome: 'QA - São José | 東京'
    })

    const response = await api.request('GET', `/usuarios/${user.id}`)
    expect(response.status()).toBe(200)
    expect((await responseBody(response)).nome).toBe(user.nome)
  })

  test('gets a user by ID and rejects a nonexistent ID', async ({ api, testData }) => {
    const user = await testData.createUser({ admin: false })
    const foundResponse = await api.request('GET', `/usuarios/${user.id}`)

    expect(foundResponse.status()).toBe(200)
    expect(await responseBody(foundResponse)).toMatchObject({
      _id: user.id,
      email: user.email
    })

    const missingResponse = await api.request('GET', `/usuarios/${makeUnknownId('user')}`)
    expect(missingResponse.status()).toBe(400)
    expect((await responseBody(missingResponse)).message).toBeTruthy()
  })

  test('creates a user and rejects a duplicate email', async ({ api, testData }) => {
    const user = await testData.createUser({ admin: false })
    const duplicateResponse = await api.request('POST', '/usuarios', {
      data: {
        nome: user.nome,
        email: user.email,
        password: user.password,
        administrador: user.administrador
      }
    })

    expect(duplicateResponse.status()).toBe(400)
    expect((await responseBody(duplicateResponse)).message).toBeTruthy()
  })

  test('rejects a user registration with a required field missing', async ({ api }) => {
    const response = await api.request('POST', '/usuarios', {
      data: {
        nome: 'Incomplete QA User',
        password: 'Valid-password-123!',
        administrador: 'false'
      }
    })

    expect(response.status()).toBe(400)
  })

  test('updates an existing user and persists the changed fields', async ({ api, testData }) => {
    const user = await testData.createUser({ admin: false })
    const updated = {
      nome: `Updated ${user.nome}`,
      email: `updated.${Date.now()}@example.com`,
      password: user.password,
      administrador: 'true'
    }

    const updateResponse = await api.request('PUT', `/usuarios/${user.id}`, {
      data: updated
    })
    expect(updateResponse.status()).toBe(200)

    const getResponse = await api.request('GET', `/usuarios/${user.id}`)
    expect(getResponse.status()).toBe(200)
    expect(await responseBody(getResponse)).toMatchObject({
      _id: user.id,
      nome: updated.nome,
      email: updated.email,
      administrador: 'true'
    })
  })

  test('creates a user when PUT targets a previously unknown ID', async ({ api, testData }) => {
    const id = makeUnknownId('put-user')
    const user = {
      nome: 'PUT-created QA user',
      email: `put.${Date.now()}@example.com`,
      password: 'Valid-password-123!',
      administrador: 'false'
    }

    const response = await api.request('PUT', `/usuarios/${id}`, { data: user })
    const created = await responseBody(response)
    if (typeof created._id === 'string') testData.trackUser(created._id)
    expect(response.status()).toBe(201)
    expect(created._id).toEqual(expect.any(String))

    const getResponse = await api.request('GET', `/usuarios/${created._id}`)
    expect(getResponse.status()).toBe(200)
    expect(await responseBody(getResponse)).toMatchObject({
      _id: created._id,
      email: user.email
    })
  })

  test('deletes an existing user', async ({ api, testData }) => {
    const user = await testData.createUser({ admin: false })

    const deleteResponse = await api.request('DELETE', `/usuarios/${user.id}`)
    expect(deleteResponse.status()).toBe(200)

    const getResponse = await api.request('GET', `/usuarios/${user.id}`)
    expect(getResponse.status()).toBe(400)
  })

  test('prevents deleting a user who owns a cart', async ({ api, testData }) => {
    const admin = await testData.createUser({ admin: true })
    const user = await testData.createUser({ admin: false })
    const product = await testData.createProduct(admin, { quantidade: 5 })
    const cartResponse = await testData.createCart(user, [
      { idProduto: product.id, quantidade: 1 }
    ])
    expect(cartResponse.status()).toBe(201)

    const deleteResponse = await api.request('DELETE', `/usuarios/${user.id}`)
    expect(deleteResponse.status()).toBe(400)
    expect((await responseBody(deleteResponse)).message).toBeTruthy()

    const getResponse = await api.request('GET', `/usuarios/${user.id}`)
    expect(getResponse.status()).toBe(200)
  })
})
