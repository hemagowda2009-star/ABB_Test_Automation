const { expect } = require('@playwright/test');

class ThingsBoardLoginPage {
    constructor(page) {
        this.page = page;
        this.baseUrl = (process.env.TB_BASE_URL || 'https://demo.thingsboard.io').replace(/\/$/, '');

        // Label/role first, attribute fallback in case the accessible name changes between TB versions
        this.usernameInput = page.getByLabel(/username|email/i)
            .or(page.locator('input[formcontrolname="username"], #username-input'))
            .first();
        this.passwordInput = page.getByLabel(/password/i)
            .or(page.locator('input[formcontrolname="password"], #password-input'))
            .first();
        this.loginButton = page.getByRole('button', { name: /^log ?in$/i })
            .or(page.locator('button[type="submit"]'))
            .first();
    }

    async open() {
        await this.page.goto(`${this.baseUrl}/login`, { waitUntil: 'domcontentloaded' });
        await expect(this.usernameInput).toBeVisible();
    }

    async login() {
        const username = process.env.TB_USERNAME;
        const password = process.env.TB_PASSWORD;
        if (!username || !password) {
            throw new Error('TB_USERNAME and TB_PASSWORD must be set in .env (see .env.example)');
        }
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.loginButton.click();
        await expect(this.page).not.toHaveURL(/\/login/, { timeout: 30000 });
    }
}

module.exports = { ThingsBoardLoginPage };
