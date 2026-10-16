# API coverage review

Coverage is grouped by the target Swagger route inventory and the acceptance rules
in the supplied ServeRest plan. This is functional/contract-oriented API coverage,
not a claim of exhaustive security, load or schema-fuzz testing.

| Resource / route | Positive coverage | Negative / edge coverage |
| --- | --- | --- |
| `POST /login` | Valid user returns an authorization value; token used on a protected route | Wrong password; unknown email; missing credentials; standard-user token cannot create products |
| `GET /usuarios` | List and unique-email filter | No-match filter returns an empty result |
| `POST /usuarios` | Runtime-created standard/admin users; Unicode/punctuation in names | Duplicate email; missing required email |
| `GET /usuarios/{_id}` | Existing user and persisted updates | Unknown ID |
| `PUT /usuarios/{_id}` | Update existing record; create-on-missing response | Missing target starts with a runtime-generated, non-seeded ID |
| `DELETE /usuarios/{_id}` | Delete existing user | Cart ownership prevents deletion |
| `GET /produtos` | List and unique-name filter | No-match filter returns an empty result |
| `POST /produtos` | Admin creates a product; zero stock is accepted | Missing/invalid token; standard user; duplicate name; zero/negative price; negative stock; verifies unauthorized attempts did not create a product |
| `GET /produtos/{_id}` | Existing product and changed stock/fields | Unknown ID |
| `PUT /produtos/{_id}` | Update existing record; create-on-missing response | Missing and standard-user tokens |
| `DELETE /produtos/{_id}` | Delete an unreferenced product | Missing/standard-user tokens; a product in a cart cannot be deleted |
| `POST /carrinhos` | Cart is linked to the token user; inventory is decremented | Missing/invalid token; second cart; duplicate item; unknown product; insufficient/zero stock; zero/negative/over-stock quantity; inventory remains unchanged on rejected carts |
| `GET /carrinhos` | Filtered list returns the current user's cart | — |
| `GET /carrinhos/{_id}` | Cart contents, owner and totals | Unknown cart ID |
| `DELETE /carrinhos/cancelar-compra` | Cart removed and inventory restored | Missing token |
| `DELETE /carrinhos/concluir-compra` | Cart removed and inventory remains decremented | Invalid token |

## Execution observations

- Latest full run: `npm test` against the target on 2026-10-16; **37 passed**.
- Scenarios use unique IDs/emails and do not depend on seeded user/product IDs.
- `PUT` with an unknown ID is documented to create a resource (HTTP 201). In the
  live target, the response contains a generated `_id` that differs from the path
  ID. The tests verify the returned resource ID rather than assuming the requested
  path becomes the stored ID.
- Unknown-resource responses use HTTP 400. Assertions focus on documented status
  and resource state; error-message text is not over-specified.
- Cart tests verify inventory before/after the transition, rather than treating a
  successful response alone as proof of correct behavior.
- Live probes confirmed that `preco` must be positive, product `quantidade` may be
  zero but not negative, and cart item quantity must be positive.

## Deferred / environment-dependent coverage

- Token expiry requires a deterministic way to issue an expired token.
- Concurrent cart creation/stock races require a controlled, isolated inventory
  environment; the live shared service is unsuitable for stable race assertions.
- Exhaustive query-filter combinations and systematic payload fuzzing are not
  included in this first regression suite.
- Maximum practical numeric values and very long field lengths are not exhaustively
  tested; the public schema does not specify maximum bounds.

Before release, run the suite against the intended deployment, review the HTML
report and traces for failures, and confirm every teardown completed.
