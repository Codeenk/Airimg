import { test, expect } from '@playwright/test';

test.describe('Airimg Web App E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads home page with hero section and sign-in button', async ({ page }) => {
    await expect(page.locator('.header-title')).toHaveText('Airimg');
    await expect(page.locator('#auth-btn')).toContainText('Sign in with Google');
    await expect(page.locator('.hero-title')).toContainText('Instant image hotlinks.');
  });

  test('displays dropzone with correct instructions and type limits', async ({ page }) => {
    const dropzone = page.locator('#dropzone');
    await expect(dropzone).toBeVisible();
    await expect(dropzone).toContainText('Drop an image here');
    await expect(dropzone).toContainText('PNG, JPEG, GIF, WebP, BMP, TIFF • Max 25MB');
  });

  test('shows error when dropping file while not signed in', async ({ page }) => {
    // Attempt file drop without sign in
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake_image_data'),
    });

    const errorBanner = page.locator('#error-banner');
    await expect(errorBanner).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('Please sign in with Google first.');
  });

  test('shows error when selecting an invalid file type', async ({ page }) => {
    // Mock user signed in via sessionStorage
    await page.evaluate(() => {
      sessionStorage.setItem('airimg_auth_tokens', JSON.stringify({
        accessToken: 'fake_token',
        expiresAt: Date.now() + 3600000,
        scope: 'drive.file',
      }));
    });
    await page.reload();

    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake_pdf_data'),
    });

    const errorBanner = page.locator('#error-banner');
    await expect(errorBanner).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('Unsupported file type');
  });
});
