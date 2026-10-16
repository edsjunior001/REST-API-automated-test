# ServeRest API automation

Risk-based REST API tests for `https://compassuol.serverest.dev/`, implemented with
Playwright Test's API request support.

## Scope

The suite covers authentication, users, products and carts, including positive,
negative and edge scenarios:

- Authentication success, invalid credentials and role enforcement.
- User and product listing/filtering, CRUD, duplicate data, missing records and
  the documented create-on-missing `PUT` behavior.
- Admin-only product mutations and unauthenticated/standard-user requests.
- Cart ownership, one-cart-per-user, duplicate items, product/stock boundaries,
  purchase completion and cancellation.
- Cross-resource rules: cart creation decrements inventory, cancellation restores
  inventory, completed purchases do not restore it, and cart dependencies block
  user/product deletion.

The target's live Swagger document reported version `3.2.2` when the suite was
implemented. The live target and its Swagger document take precedence over
assumptions or stale examples.

## Requirements and commands

Requires Node.js 18 or later.

```sh
npm install
npm test
npm run test:smoke
npm run test:report
```

Set `API_BASE_URL` to run against another compatible ServeRest environment:

```sh
API_BASE_URL=https://compassuol.serverest.dev npm test
```

The suite is deliberately single-worker because the target environment is shared
and tests mutate users, inventory and carts. Each scenario creates unique records;
the `testData` fixture cancels carts and deletes created products/users at teardown.
Review teardown failures in the test output instead of treating a test as clean.

## Project layout

- `tests/`: API scenario specs grouped by resource.
- `tests/fixtures.js`: shared API and isolated data setup/cleanup fixtures.
- `src/api-client.js`: shared request wrapper; status handling remains explicit in
  each test.
- `src/test-data.js`: unique, runtime-generated user/product/ID data.
- `playwright.config.js`: target URL, serialized execution, trace and HTML report.
- `docs/COVERAGE.md`: scenario-to-route coverage and known gaps.
- `docs/GENAI-WORKFLOW.md`: GenAI prompt set and human validation decisions.

## Safety and known limits

Tests make real requests and create temporary data in the configured API. Use only
a test environment where that is permitted. Do not run against production data.
Cleanup is attempted after each test and reports failures, but an unavailable
remote API can prevent cleanup.

Token expiry and concurrent inventory contention are not deterministic in this
shared environment and are left as explicit follow-up coverage. The suite does not
assume an item-level cart deletion, refund or payment-gateway API.
