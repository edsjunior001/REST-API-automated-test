# GenAI-assisted QA workflow

## Selected tool and human control

Copilot in VS Code was used as the GenAI assistant for test design, implementation
and review. The prompts below capture the reusable workflow. Suggestions were
checked against the target's live Swagger document (`3.2.2`) and observed runtime
responses; generated output was not treated as authoritative.

## Prompt set

### 1. Risk-based API test design

> Act as a senior REST API QA engineer. Design a risk-based test matrix for
> `https://compassuol.serverest.dev/` covering only documented login, users,
> products and carts routes. Include positive, negative and edge cases, HTTP
> status, authorization, response shape and cross-resource state. Prioritize
> unique runtime data and shared-environment risks. Do not invent endpoints,
> payment/refund functionality or unsupported rules. Separate requirements
> confirmed by Swagger from assumptions.

### 2. Test implementation and fixtures

> Implement the approved scenarios using Playwright Test API requests. Create a
> small shared API client and per-test data fixture. Generate unique users and
> products at runtime, use an admin and standard user as needed, record created
> IDs, and clean carts before products/users. Keep tests independent and
> single-worker for shared inventory. Assert statuses and state transitions
> explicitly; do not hard-code seeded IDs or hide failed cleanup.

### 3. Refactor and maintainability review

> Review the API tests for repeated request setup, test-data leakage, brittle exact
> message assertions, hidden authorization assumptions and dependency between
> tests. Propose the smallest refactor that centralizes request construction and
> lifecycle cleanup without hiding per-scenario assertions or swallowing errors.

### 4. Debug a failing contract assertion

> A Playwright API test expected a documented status but received another status.
> Inspect the failing request body, target Swagger operation, returned status/body
> and follow-up resource state. Determine whether the test's assumption is wrong
> or the target violates its contract. Do not change an assertion merely to make
> the test pass; retain evidence and clean up any resource created during probing.

### 5. Coverage gap review

> Compare the executed API test names to the route inventory and risk matrix.
> Identify untested methods, role boundaries, duplicate/invalid data, ID edges,
> stock transitions and cross-resource restrictions. Distinguish intentionally
> deferred environment-dependent cases from omissions. Do not claim coverage
> based only on the number of tests.

### 6. Documentation

> Write concise project documentation with setup/run commands, configuration,
> stateful-test safety, cleanup behavior, coverage by route, observed target
> behavior and explicit known gaps. Do not report planned or unexecuted behavior
> as passing test evidence.

## Human validation and adjustment log

| ID | GenAI suggestion / risk | Human validation and decision |
| --- | --- | --- |
| HV-01 | Require authentication on all read routes | Checked the live route security definitions. Public list/lookups stay unauthenticated; protected product mutations and cart operations have explicit auth tests. |
| HV-02 | Add cart item removal, payment and refund coverage | Removed these: they are not present in the supplied route inventory. Only complete/cancel cart operations are tested. |
| HV-03 | Treat unknown-ID `PUT` as a `404`, or assume the requested path ID is stored | Checked the live target. It returns `201` and a generated `_id` different from the requested ID; tests use that response ID for retrieval and cleanup. |
| HV-04 | Assert only cart creation response success | Added stock checks before/after cart creation, failed cart attempts, cancellation and completion. |
| HV-05 | Reuse fixture/seed IDs across tests | Replaced with UUID-derived test users, products and unknown IDs to limit shared-environment collisions. |
| HV-06 | Assert exact wording for all error responses | Assertions use the documented status and state behavior; exact localized copy is asserted only where it is part of the contract. |
| HV-07 | Treat missing-resource response as a uniform JSON message for any malformed path ID | Probed valid-length generated IDs. Unknown-resource tests use the target's 16-character ID format and avoid assuming payload shape beyond the documented message/status. |
| HV-08 | Treat the live environment as stable and test in parallel | Configured one worker and per-test setup/cleanup because cart and stock state is shared and mutable. |
| HV-09 | Assume numeric lower bounds from the GenAI plan | Probed the live target: zero/negative prices and negative product/cart quantities return HTTP 400; zero product stock is allowed. Added assertions for these observed boundaries and recorded the result. |
| HV-10 | Treat test assertions as proof of success without checking cleanup | Added teardown that cancels carts, deletes generated products/users and throws an aggregate error if cleanup fails. |

## Debugging record

The first full run exposed several incorrect test assumptions:

- Existing-record `PUT` tests initially sent fixture-only fields (`id` and token)
  and reused a user's email. The requests were reduced to contract fields and the
  update uses a unique email.
- Initial unknown IDs were longer than the target's generated ID format and
  produced unhelpful error bodies. Unknown IDs now match the observed 16-character
  format.
- The API returns a generated identifier for successful create-on-missing `PUT`;
  follow-up GET and cleanup now use the response `_id`.
- Unknown cart/user/product error responses are checked for status without
  requiring an undocumented message shape.

These adjustments preserve meaningful assertions while reflecting target evidence.
See `COVERAGE.md` for deferred scenarios and the latest suite execution result.
