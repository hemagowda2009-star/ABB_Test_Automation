async function waitForPageLoad(page) {
  await page.waitForLoadState('domcontentloaded');
}

function randomString(length = 8) {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length);
}

module.exports = { waitForPageLoad, randomString };
