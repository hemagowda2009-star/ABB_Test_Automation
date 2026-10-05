const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const NUMBER_PATTERN = /-?\d+(?:[.,]\d+)?/;

class DashboardPage {
    constructor(page) {
        this.page = page;

        this.dashboardsMenu = page.getByRole('link', { name: /^dashboards$/i })
            .or(page.locator('a[href$="/dashboards"]'))
            .first();
        this.dashboardRows = page.getByRole('row');
        this.widgets = page.locator('tb-widget-container, .tb-widget-container, tb-widget');
        this.dashboardContainer = page.locator('tb-dashboard-page, tb-dashboard, .tb-dashboard-page').first();
    }

    // "All" only exists as a group tab/link on some ThingsBoard editions, so it is optional
    async openGroup(groupName) {
        const group = this.page.getByRole('tab', { name: groupName, exact: true })
            .or(this.page.getByRole('link', { name: groupName, exact: true }))
            .first();
        if (await group.isVisible().catch(() => false)) {
            await group.click();
        }
    }

    async navigateToDashboard(groupName, dashboardName) {
        await this.dashboardsMenu.click();
        await expect(this.page).toHaveURL(/dashboard/i);
        await this.openGroup(groupName);

        const row = this.dashboardRows.filter({ hasText: dashboardName }).first();
        await expect(row).toBeVisible({ timeout: 20000 });
        await row.getByText(dashboardName, { exact: true }).click();

        await expect(this.page).toHaveURL(/dashboards?\/[0-9a-f-]{36}/i, { timeout: 20000 });
        await expect(this.widgets.first()).toBeVisible({ timeout: 30000 });
    }

    async verifyDashboardDisplayed(dashboardName) {
        await expect(this.dashboardContainer).toBeVisible();
        await expect(this.page.getByText(dashboardName, { exact: true }).first()).toBeVisible();
    }

    widgetByTitle(title) {
        return this.widgets.filter({ hasText: title }).first();
    }

    async verifyWidgetVisible(title) {
        await expect(this.widgetByTitle(title)).toBeVisible({ timeout: 20000 });
    }

    // Prefer a dedicated value element; fall back to the widget text minus its title
    async readWidgetValue(title) {
        const widget = this.widgetByTitle(title);
        const valueElement = widget.locator('[class*="value"]').filter({ hasText: NUMBER_PATTERN }).first();

        let text;
        if (await valueElement.count() > 0) {
            text = await valueElement.innerText();
        } else {
            text = (await widget.innerText()).replace(title, '');
        }

        const match = text.match(NUMBER_PATTERN);
        if (!match) {
            throw new Error(`No numeric telemetry value found in widget "${title}". Text: "${text.trim()}"`);
        }
        return Number(match[0].replace(',', '.'));
    }

    async verifyValueInRange({ title, min, max }) {
        await expect.poll(() => this.readWidgetValue(title).catch(() => NaN), {
            message: `Widget "${title}" should show a numeric value`,
            timeout: 20000
        }).not.toBeNaN();

        const value = await this.readWidgetValue(title);
        expect(value, `${title} value ${value} should be >= ${min}`).toBeGreaterThanOrEqual(min);
        expect(value, `${title} value ${value} should be <= ${max}`).toBeLessThanOrEqual(max);
        return value;
    }

    async verifyValueUpdates(title, { maxWaitMs, pollIntervalMs }) {
        const initial = await this.readWidgetValue(title);
        await expect.poll(() => this.readWidgetValue(title), {
            message: `Widget "${title}" value should change from ${initial} within ${maxWaitMs} ms`,
            timeout: maxWaitMs,
            intervals: [pollIntervalMs]
        }).not.toBe(initial);
        return { initial, updated: await this.readWidgetValue(title) };
    }

    async verifyChartRendered(title) {
        const chart = this.widgetByTitle(title);
        await expect(chart).toBeVisible({ timeout: 20000 });
        await expect(chart.locator('canvas, svg').first()).toBeVisible();
        const box = await chart.boundingBox();
        expect(box && box.width > 0 && box.height > 0, `Chart "${title}" should have a rendered area`).toBeTruthy();
    }

    async captureScreenshot(dir, name) {
        fs.mkdirSync(dir, { recursive: true });
        const safeName = name.replace(/[^a-z0-9_-]/gi, '_');
        const filePath = path.join(dir, `${safeName}_${Date.now()}.png`);
        const buffer = await this.page.screenshot({ path: filePath, fullPage: true });
        return { filePath, buffer };
    }
}

module.exports = { DashboardPage };
