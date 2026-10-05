const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function toResult(response) {
    const text = await response.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = text;
    }
    return { status: response.status(), body };
}

class ThingsBoardApiClient {
    constructor(apiContext, { attempts = 3, delayMs = 1000 } = {}) {
        this.api = apiContext;
        this.retry = { attempts, delayMs };
        this.token = null;
        this.refreshToken = null;
    }

    // Retries network errors and 429/5xx with linear backoff; refreshes the JWT once on 401
    async send(method, url, { params, data, auth = true, token } = {}) {
        let refreshed = Boolean(token);
        for (let attempt = 1; ; attempt++) {
            const bearer = token || this.token;
            const headers = auth && bearer ? { 'X-Authorization': `Bearer ${bearer}` } : {};

            let response;
            try {
                response = await this.api.fetch(url, { method, params, data, headers, failOnStatusCode: false });
            } catch (error) {
                if (attempt >= this.retry.attempts) throw error;
                await delay(this.retry.delayMs * attempt);
                continue;
            }

            if (response.status() === 401 && auth && !refreshed && this.refreshToken) {
                refreshed = true;
                await this.refreshAccessToken();
                continue;
            }
            if (RETRYABLE_STATUSES.has(response.status()) && attempt < this.retry.attempts) {
                await delay(this.retry.delayMs * attempt);
                continue;
            }
            return toResult(response);
        }
    }

    async login(username, password) {
        const result = await this.send('POST', '/api/auth/login', { data: { username, password }, auth: false });
        if (result.status === 200) {
            this.token = result.body.token;
            this.refreshToken = result.body.refreshToken;
        }
        return result;
    }

    async refreshAccessToken() {
        const result = await this.send('POST', '/api/auth/token', {
            data: { refreshToken: this.refreshToken },
            auth: false
        });
        if (result.status !== 200) {
            throw new Error(`Token refresh failed with HTTP ${result.status}`);
        }
        this.token = result.body.token;
        this.refreshToken = result.body.refreshToken;
    }

    getDeviceByName(deviceName) {
        return this.send('GET', '/api/tenant/devices', { params: { deviceName } });
    }

    getTimeseriesKeys(deviceId) {
        return this.send('GET', `/api/plugins/telemetry/DEVICE/${deviceId}/keys/timeseries`);
    }

    getLatestTelemetry(deviceId, keys, options = {}) {
        return this.send('GET', `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`, {
            params: { keys: keys.join(',') },
            ...options
        });
    }

    getTelemetryHistory(deviceId, keys, { startTs, endTs, limit }) {
        return this.send('GET', `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`, {
            params: { keys: keys.join(','), startTs, endTs, limit, agg: 'NONE', orderBy: 'DESC' }
        });
    }

    async pollUntil(fetchFn, isReady, { maxWaitMs, pollIntervalMs }, description) {
        const deadline = Date.now() + maxWaitMs;
        let last;
        while (true) {
            last = await fetchFn();
            if (isReady(last)) return last;
            if (Date.now() + pollIntervalMs > deadline) {
                throw new Error(`Timed out after ${maxWaitMs} ms waiting for ${description}. Last response: ` +
                    `HTTP ${last.status} ${JSON.stringify(last.body)}`);
            }
            await delay(pollIntervalMs);
        }
    }

    static decodeJwtPayload(token) {
        const [, payload] = token.split('.');
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    }
}

module.exports = { ThingsBoardApiClient };
