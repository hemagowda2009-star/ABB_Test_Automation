const { Given, When, Then } = require('@cucumber/cucumber');
const { ThingsBoardLoginPage } = require('../pages/ThingsBoardLoginPage');
const { DashboardPage } = require('../pages/DashboardPage');
const tbData = require('../test-data/thingsboardData.json');

function widgetConfig(title) {
    const widget = tbData.telemetryWidgets.find((w) => w.title === title);
    if (!widget) {
        throw new Error(`Widget "${title}" is not configured in test-data/thingsboardData.json`);
    }
    return widget;
}

Given('the user opens the ThingsBoard login page', async function () {
    this.tbLoginPage = new ThingsBoardLoginPage(this.page);
    await this.tbLoginPage.open();
});

When('the user logs in to ThingsBoard with valid credentials', async function () {
    await this.tbLoginPage.login();
});

When('the user navigates to the configured telemetry dashboard', async function () {
    this.dashboardPage = new DashboardPage(this.page);
    await this.dashboardPage.navigateToDashboard(tbData.dashboard.group, tbData.dashboard.name);
});

Then('the telemetry dashboard should be displayed', async function () {
    await this.dashboardPage.verifyDashboardDisplayed(tbData.dashboard.name);
});

Then('all configured telemetry widgets should be visible', async function () {
    for (const widget of tbData.telemetryWidgets) {
        await this.dashboardPage.verifyWidgetVisible(widget.title);
    }
});

Then('each telemetry widget should show a numeric value within its expected range', async function () {
    for (const widget of tbData.telemetryWidgets) {
        const value = await this.dashboardPage.verifyValueInRange(widget);
        this.log(`${widget.title}: ${value} ${widget.unit} (expected ${widget.min}..${widget.max})`);
    }
});

Then('the {string} widget value should update in real time', async function (title) {
    widgetConfig(title);
    const { initial, updated } = await this.dashboardPage.verifyValueUpdates(title, tbData.realtime);
    this.log(`${title} changed from ${initial} to ${updated}`);
});

Then('the time-series chart widget should be rendered', async function () {
    await this.dashboardPage.verifyChartRendered(tbData.chartWidget.title);
});

Then('a dashboard screenshot named {string} is captured', async function (name) {
    const { filePath, buffer } = await this.dashboardPage.captureScreenshot(tbData.screenshotDir, name);
    await this.attach(buffer, 'image/png');
    this.log(`Screenshot saved: ${filePath}`);
});