const {
  Before,
  After,
  setDefaultTimeout,
  Status
} = require('@cucumber/cucumber');

const fs = require('fs');
const { startBrowserSession } = require('./browserSession');
require('dotenv').config();
setDefaultTimeout(60 * 1000);

Before({ tags: 'not @api' }, async function () {
  // Create folders if not present
  if (!fs.existsSync('test-results/videos')) {
    fs.mkdirSync('test-results/videos', { recursive: true });
  }
  if (!fs.existsSync('test-results/traces')) {
    fs.mkdirSync('test-results/traces', { recursive: true });
  }
  if (!fs.existsSync('test-results/screenshots')) {
    fs.mkdirSync('test-results/screenshots', { recursive: true });
  }

  // Arrays to store logs
  this.consoleLogs = [];
  this.pageErrors = [];
  this.networkFailures = [];

  await startBrowserSession(this);

});

After({ tags: 'not @api' }, async function (scenario) {

  const hasFailed = scenario.result.status === Status.FAILED;
  const video = this.page?.video();
  const videoPath = `test-results/videos/${Date.now()}.webm`;

  try {

    if (hasFailed) {

      // Screenshot

      const screenshot = await this.page.screenshot({
        path: `test-results/screenshots/${Date.now()}.png`
      });

      await this.attach(
        screenshot,
        'image/png'
      );

      // Trace

      const traceFile =
        `test-results/traces/${Date.now()}.zip`;

      await this.context.tracing.stop({
        path: traceFile
      });

      const traceBuffer =
        fs.readFileSync(traceFile);

      await this.attach(
        traceBuffer,
        'application/zip'
      );

    }
    else {
      await this.context.tracing.stop();
    }
  } catch (error) {
    console.log(
      'After Hook Error:',
      error.message
    );
  }
  finally {
    try {
      await this.page?.close().catch(() => { });
      await this.context?.close().catch(() => { });

      if (hasFailed && video) {
        await video.saveAs(videoPath);

        if (fs.existsSync(videoPath)) {
          const videoBuffer = fs.readFileSync(videoPath);
          await this.attach(
            videoBuffer,
            'video/webm'
          );
        }
      }
    } catch (error) {
      console.log(
        'After Hook Cleanup Error:',
        error.message
      );
    } finally {
      await this.browser?.close().catch(() => { });
    }
  }

});