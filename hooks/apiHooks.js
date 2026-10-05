const { Before, After } = require('@cucumber/cucumber');
const { request } = require('@playwright/test');
require('dotenv').config();

Before({ tags: '@api' }, async function () {
  this.apiContext = await request.newContext({
    baseURL: (process.env.TB_BASE_URL || 'https://demo.thingsboard.io').replace(/\/$/, ''),
    extraHTTPHeaders: { Accept: 'application/json' }
  });
});

After({ tags: '@api' }, async function () {
  await this.apiContext?.dispose();
});
