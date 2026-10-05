const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { ThingsBoardApiClient } = require('../api/ThingsBoardApiClient');
const apiData = require('../test-data/thingsboardApiData.json');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const telemetryKeys = apiData.telemetryKeys.map((k) => k.key);

function attachJson(world, label, payload) {
    return world.attach(JSON.stringify({ label, ...payload }, null, 2), 'application/json');
}

function requireDeviceId(world) {
    if (!world.deviceId) {
        throw new Error('Device ID not set - run "the telemetry device is looked up by name" first');
    }
    return world.deviceId;
}

Given('the ThingsBoard API client is authenticated with valid credentials', async function () {
    const username = process.env.TB_USERNAME;
    const password = process.env.TB_PASSWORD;
    if (!username || !password) {
        throw new Error('TB_USERNAME and TB_PASSWORD must be set in .env (see .env.example)');
    }
    this.apiClient = new ThingsBoardApiClient(this.apiContext, apiData.retry);
    this.loginResult = await this.apiClient.login(username, password);
    expect(this.loginResult.status, `Login failed: ${JSON.stringify(this.loginResult.body)}`).toBe(200);
});

Then('the login response should contain a valid JWT for the configured user', async function () {
    const { token, refreshToken } = this.loginResult.body;
    expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(refreshToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

    const claims = ThingsBoardApiClient.decodeJwtPayload(token);
    expect(claims.sub).toBe(process.env.TB_USERNAME);
    expect(claims.exp * 1000).toBeGreaterThan(Date.now());
    this.log(`JWT for ${claims.sub}, expires ${new Date(claims.exp * 1000).toISOString()}`);
});

When('the telemetry device is looked up by name', async function () {
    this.lastResult = await this.apiClient.getDeviceByName(apiData.device.name);
    await attachJson(this, 'GET /api/tenant/devices', this.lastResult);
    expect(this.lastResult.status, `Device "${apiData.device.name}" lookup failed`).toBe(200);
    this.device = this.lastResult.body;
    this.deviceId = this.device.id.id;
});

When('the device time-series keys are requested', async function () {
    this.lastResult = await this.apiClient.getTimeseriesKeys(requireDeviceId(this));
    await attachJson(this, 'GET keys/timeseries', this.lastResult);
});

When('latest telemetry is requested with an invalid token', async function () {
    this.lastResult = await this.apiClient.getLatestTelemetry(requireDeviceId(this), telemetryKeys, {
        token: 'invalid.jwt.token'
    });
});

When('latest telemetry is polled until all configured keys are streamed', async function () {
    const deviceId = requireDeviceId(this);
    this.lastResult = await this.apiClient.pollUntil(
        () => this.apiClient.getLatestTelemetry(deviceId, telemetryKeys),
        (r) => r.status === 200 && telemetryKeys.every((k) => Array.isArray(r.body?.[k]) && r.body[k].length > 0),
        apiData.polling,
        `telemetry keys [${telemetryKeys.join(', ')}]`
    );
    this.telemetry = this.lastResult.body;
    await attachJson(this, 'GET values/timeseries (latest)', this.lastResult);
});

When('telemetry history for the configured window is requested', async function () {
    const endTs = Date.now();
    this.lastResult = await this.apiClient.getTelemetryHistory(requireDeviceId(this), telemetryKeys, {
        startTs: endTs - apiData.history.windowMs,
        endTs,
        limit: apiData.history.limit
    });
    await attachJson(this, 'GET values/timeseries (history)', this.lastResult);
});

Then('the API response status should be {int}', async function (status) {
    expect(this.lastResult.status, JSON.stringify(this.lastResult.body)).toBe(status);
});

Then('the device response should identify a DEVICE entity with the configured name', async function () {
    expect(this.device.name).toBe(apiData.device.name);
    expect(this.device.id.entityType).toBe('DEVICE');
    expect(this.device.id.id).toMatch(UUID_PATTERN);
});

Then('the device should expose all configured telemetry keys', async function () {
    expect(Array.isArray(this.lastResult.body)).toBeTruthy();
    expect(this.lastResult.body).toEqual(expect.arrayContaining(telemetryKeys));
});

Then('each telemetry key should contain exactly one latest data point', async function () {
    for (const key of telemetryKeys) {
        expect(this.telemetry[key], `latest data for "${key}"`).toHaveLength(1);
        expect(this.telemetry[key][0]).toEqual(expect.objectContaining({
            ts: expect.any(Number),
            value: expect.anything()
        }));
    }
});

Then('each telemetry data point should have a numeric timestamp within the freshness window', async function () {
    const now = Date.now();
    for (const key of telemetryKeys) {
        const { ts } = this.telemetry[key][0];
        expect(Number.isInteger(ts), `"${key}" ts should be epoch millis`).toBeTruthy();
        expect(ts, `"${key}" ts should not be in the future`).toBeLessThanOrEqual(now + 60000);
        expect(now - ts, `"${key}" is older than ${apiData.freshnessWindowMs} ms`)
            .toBeLessThanOrEqual(apiData.freshnessWindowMs);
    }
});

Then('each telemetry data point should have a numeric value within its expected range', async function () {
    for (const { key, min, max } of apiData.telemetryKeys) {
        // ThingsBoard returns time-series values as strings
        const value = Number(this.telemetry[key][0].value);
        expect(Number.isFinite(value), `"${key}" value "${this.telemetry[key][0].value}" should be numeric`).toBeTruthy();
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThanOrEqual(max);
        this.log(`${key} = ${value} (expected ${min}..${max})`);
    }
});

Then('a newer data point for the real-time key should arrive within the polling window', async function () {
    const key = apiData.realtimeKey;
    const initialTs = this.telemetry[key][0].ts;
    const result = await this.apiClient.pollUntil(
        () => this.apiClient.getLatestTelemetry(this.deviceId, [key]),
        (r) => r.status === 200 && r.body?.[key]?.[0]?.ts > initialTs,
        apiData.polling,
        `a "${key}" data point newer than ${initialTs}`
    );
    const latest = result.body[key][0];
    this.log(`${key}: ts ${initialTs} -> ${latest.ts}, value ${latest.value}`);
    await attachJson(this, 'GET values/timeseries (realtime)', result);
});

Then('each history series should be ordered newest first with numeric values within range', async function () {
    for (const { key, min, max } of apiData.telemetryKeys) {
        const series = this.lastResult.body?.[key];
        expect(Array.isArray(series) && series.length > 0, `history for "${key}" should not be empty`).toBeTruthy();
        expect(series.length).toBeLessThanOrEqual(apiData.history.limit);

        for (let i = 0; i < series.length; i++) {
            const value = Number(series[i].value);
            expect(Number.isFinite(value)).toBeTruthy();
            expect(value).toBeGreaterThanOrEqual(min);
            expect(value).toBeLessThanOrEqual(max);
            if (i > 0) {
                expect(series[i].ts).toBeLessThanOrEqual(series[i - 1].ts);
            }
        }
        this.log(`${key}: ${series.length} history points`);
    }
});
