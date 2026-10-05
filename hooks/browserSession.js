const { chromium } = require('@playwright/test');

async function startBrowserSession(world) {
  world.browser = await chromium.launch({ headless: false });
  world.context = await world.browser.newContext({
    recordVideo: {
      dir: 'test-results/videos/',
      size: {
        width: 1280,
        height: 720
      }
    }
  });
  await world.context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true
  });
  world.page = await world.context.newPage();

  world.page.on('console', (msg) => {
    world.consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  world.page.on('pageerror', (error) => {
    world.pageErrors.push(error.message);
  });
  world.page.on('requestfailed', (request) => {
    world.networkFailures.push(`${request.method()} ${request.url()}`);
  });
}

async function restartBrowserSession(world) {
  await world.context?.tracing.stop().catch(() => {});
  await world.page?.close().catch(() => {});
  await world.context?.close().catch(() => {});
  await world.browser?.close().catch(() => {});
  await startBrowserSession(world);
}

module.exports = { startBrowserSession, restartBrowserSession };