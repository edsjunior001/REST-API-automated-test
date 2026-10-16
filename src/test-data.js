const { randomUUID } = require('node:crypto')

function makeUniqueEmail(prefix = 'qa') {
  return `${prefix}.${randomUUID()}@example.com`
}

function makeUser({ admin = false, ...overrides } = {}) {
  const uniqueId = randomUUID()

  return {
    nome: `QA User ${uniqueId.slice(0, 8)}`,
    email: makeUniqueEmail(),
    password: `Qa-${uniqueId}-Pass!`,
    administrador: String(admin),
    ...overrides
  }
}

function makeProduct(overrides = {}) {
  const uniqueId = randomUUID()

  return {
    nome: `QA Product ${uniqueId}`,
    preco: 137,
    descricao: `Automated API test product ${uniqueId}`,
    quantidade: 20,
    ...overrides
  }
}

function makeUnknownId(prefix = 'missing') {
  const firstCharacter = prefix.replace(/[^a-z0-9]/gi, '').slice(0, 1) || 'Q'
  return `${firstCharacter}${randomUUID().replaceAll('-', '').slice(0, 15)}`
}

module.exports = { makeProduct, makeUniqueEmail, makeUnknownId, makeUser }
