# ThingsBoard Dashboard UI Automation (Playwright + Cucumber BDD, JavaScript)

UI automation for the **Device Telemetry Dashboard** on the ThingsBoard live demo (https://demo.thingsboard.io), built on the existing Playwright + Cucumber framework in this repository.

> **Note:** The demo login was unavailable while this suite was written. Selectors and dashboard/widget names are based on the standard ThingsBoard (Angular Material) UI and are held in `test-data/thingsboardData.json`, so they can be corrected without touching code once access is restored.

## Project structure

| Path | Purpose |
|------|---------|
| `features/test_dashboard_ui.feature` | Gherkin scenarios for the dashboard validations |
| `step-definitions/test_dashboard_ui.js` | Step definitions (deliverable `test_dashboard_ui.js`) |
| `pages/ThingsBoardLoginPage.js` | Page object: ThingsBoard login |
| `pages/DashboardPage.js` | Page object: dashboard navigation, widget reads, real-time checks, screenshots |
| `test-data/thingsboardData.json` | Dashboard name, widget titles, value ranges, real-time timings |
| `.env.example` | Template for environment variables (copy into `.env`) |
| `hooks/hooks.js`, `hooks/browserSession.js` | Existing browser lifecycle, video, trace and failure screenshot hooks (skipped for `@api`) |
| `features/test_api_telemetry.feature` | Gherkin scenarios for the telemetry REST API (Part 2) |
| `step-definitions/test_api_telemetry.js` | API step definitions (deliverable `test_api_telemetry.js`) |
| `api/ThingsBoardApiClient.js` | REST client: JWT login/refresh, retry and polling, device and telemetry endpoints |
| `hooks/apiHooks.js` | Creates and disposes a Playwright `APIRequestContext` for `@api` scenarios (no browser) |
| `test-data/thingsboardApiData.json` | Device name, telemetry keys and ranges, freshness, polling and retry settings |

## Setup

1. Install Node.js 18+ and the dependencies:
   ```bash
   npm install
   npx playwright install chromium
   ```
2. Add the ThingsBoard keys from `.env.example` to `.env`:
   ```
   TB_BASE_URL=https://demo.thingsboard.io
   TB_USERNAME=<your demo account email>
   TB_PASSWORD=<your demo account password>
   ```
   A free demo account can be created at https://demo.thingsboard.io/signup. Do not commit real credentials.

## Running

```bash
npm run test:dashboard                          # UI dashboard scenarios
npm run test:api                                # REST API telemetry scenarios
npx cucumber-js --tags "@thingsboard and @realtime"   # only real-time checks
npx cucumber-js --dry-run --tags @thingsboard   # verify step bindings, no browser
npm run report:generate; npm run report:open    # Allure report
```

## Test scenarios

Background (every scenario): open login page → log in with `.env` credentials → **Dashboards → All → Device Telemetry Dashboard**.

| Tag | Scenario | Validation |
|-----|----------|------------|
| `@smoke` | Dashboard loads | Dashboard container and title visible; every widget in `telemetryWidgets` is visible |
| `@datavalidation` | Values valid | Each widget shows a numeric value inside its `min`..`max` range (e.g. temperature −40..85 °C, humidity 0..100 %) |
| `@realtime` | Live updates (Temperature, Humidity) | The widget value is polled every `pollIntervalMs` and must change within `maxWaitMs`, proving telemetry is streaming |
| `@chart` | Chart renders | The time-series widget contains a visible `canvas`/`svg` with a non-zero rendered area |

## Part 2: API telemetry tests

JavaScript has no `requests` library, so these tests use Playwright's `APIRequestContext`, which works the same way, inside the same Cucumber framework. Endpoints follow https://thingsboard.io/docs/reference/rest-api/.

| Endpoint | Used for |
|----------|----------|
| `POST /api/auth/login` | Get the JWT `token` and `refreshToken` |
| `POST /api/auth/token` | Refresh the token automatically after a `401` |
| `GET /api/tenant/devices?deviceName=` | Look up the device ID by name |
| `GET /api/plugins/telemetry/DEVICE/{id}/keys/timeseries` | List the device's telemetry keys |
| `GET /api/plugins/telemetry/DEVICE/{id}/values/timeseries?keys=` | Latest values |
| `GET ...values/timeseries?keys=&startTs=&endTs=&limit=&agg=NONE&orderBy=DESC` | Historical values |

Every request sends `X-Authorization: Bearer <token>`.

### Scenarios

| Tag | Scenario | Key validations |
|-----|----------|-----------------|
| `@auth` | Login | Token and refresh token are JWTs; the decoded `sub` is the configured user; `exp` is in the future |
| `@auth @negative` | Invalid token | Telemetry request returns `401` |
| `@device` | Device lookup | `200`; `name` matches; `id.entityType` is `DEVICE`; `id.id` is a UUID |
| `@device` | Telemetry keys | The key list contains every configured key |
| `@telemetry` | Latest telemetry | **Key fields:** key present, exactly one point, `ts` is epoch ms, `ts` within the freshness window, `value` numeric and in range |
| `@telemetry @realtime` | Streaming | A newer `ts` arrives for the real-time key within the polling window |
| `@telemetry @history` | History | Non-empty, at most `limit` points, newest first, all values numeric and in range |

### Retry and polling

- **Retry:** network errors and HTTP `429/500/502/503/504` are retried `retry.attempts` times, waiting `retry.delayMs × attempt` between tries.
- **Token refresh:** on a `401`, the client refreshes the JWT once and repeats the request. It does not refresh when a token is passed in explicitly, which is how the negative test still gets its `401`.
- **Polling:** `pollUntil` repeats a request every `polling.pollIntervalMs` until a condition is met or `polling.maxWaitMs` runs out. It is used to wait until every key has data, and to detect a new data point arriving.
- **Evidence:** request and response bodies are attached to the Cucumber and Allure reports as JSON. Login responses are never attached, so tokens stay out of reports.

## Selector strategy

- Role and label locators first (`getByRole`, `getByLabel`), with `.or()` fallbacks to stable Angular attributes such as `formcontrolname`. This tolerates small changes between ThingsBoard versions.
- Widgets are found by their **visible title** (`tb-widget-container` filtered by text), not by position or generated IDs.
- Dashboard rows are matched by name. The optional **All** group tab is clicked only if it exists, so the same flow works on CE and PE editions.
- There are no hard waits: the suite relies on Playwright auto-waiting and `expect.poll` for streamed values.

## Evidence

- **Screenshots:** every scenario saves a full-page screenshot to `test-results/screenshots/<name>_<timestamp>.png` and attaches it to the Cucumber and Allure reports.
- **On failure** (existing hooks): screenshot, Playwright trace (`test-results/traces/*.zip`, open with `npx playwright show-trace <file>`) and video (`test-results/videos/`).
- **Reports:** `cucumber-report/report.html` and `allure-report/`.
- Observed values (e.g. `Temperature changed from 24.1 to 24.6`) are written to the report through `this.log`.

## Adapting to the real dashboard

When demo access is available, check `test-data/thingsboardData.json` against the dashboard:
- `dashboard.name` / `dashboard.group` must match the dashboard list.
- `telemetryWidgets[].title` must match the widget header text, and `min`/`max` should reflect the simulator's range.
- `chartWidget.title` must match the time-series widget title.
- If streamed values change slowly, increase `realtime.maxWaitMs` (keep it below the 60 s Cucumber step timeout in `hooks/hooks.js`).

## Assumptions and limitations

- The dashboard, widget titles and telemetry ranges are assumed until they can be checked against the live demo.
- The real-time UI check proves a value *changes*. It does not compare the UI value against the backend.
- The API device name (`Thermostat T1`), telemetry keys and ranges in `thingsboardApiData.json` are assumed. The account must be a tenant administrator to use `/api/tenant/devices`.
- JWT login is marked deprecated in ThingsBoard 4.3+ in favour of API keys (`X-Authorization: ApiKey <key>`), but it still works on the demo.
- The demo is a shared public tenant, so data and availability can vary between runs.
