import { test, expect } from '@playwright/test';

const PROJECT_ID = 'cmuyixhhg000eua0rlm5fl9xw';
const BOARD_ID = `demo-board-${PROJECT_ID}`;
const BOARD_URL = `/projects/${PROJECT_ID}/boards/${BOARD_ID}`;

async function login(page: any, email: string, pass: string = 'development123') {
  await page.goto('/sign-in');
  await page.fill('#email-input', email);
  await page.fill('#password-input', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.pathname.includes('/sign-in'), { timeout: 15000 });
}

test.describe('Board Review & UI Fixes', () => {
  test('Fix 1 & 2: Read-only cards for Admin on Developer columns and refused move message', async ({ page }) => {
    await login(page, 'admin@example.com');
    await page.goto(BOARD_URL);
    await page.waitForSelector('[data-slot="page-header"]');

    // Confirm To Do column header displays the move rule
    const toDoHeaderNotice = page.locator('text=Only Developers can move tasks out of this column.').first();
    await expect(toDoHeaderNotice).toBeVisible();

    // Check that cards in To Do are read-only
    const firstCard = page.locator('[aria-roledescription="read-only task card"]').first();
    await expect(firstCard).toBeVisible();

    // Focus and press Space on read-only card to verify refusal message
    await firstCard.focus();
    await page.keyboard.press('Space');

    // Confirm exact refused move banner
    const banner = page.locator('text=You can\'t move this task out of To Do. Only Developers can move tasks out of this column. Ask a Developer to move it, or ask an administrator to change the column\'s rules.');
    await expect(banner).toBeVisible();
  });

  test('Fix 3: Keyboard move with Space and ArrowRight, screen reader announcements and API verification', async ({ page, request }) => {
    await login(page, 'developer@example.com');
    await page.goto(BOARD_URL);
    await page.waitForSelector('[data-slot="page-header"]');

    // Pick first movable card in To Do
    const card = page.locator('[aria-roledescription="draggable task card"]').first();
    const taskKey = await card.locator('.font-mono').first().textContent();
    expect(taskKey).toBeTruthy();

    // 1. Focus card and press Space to pick up
    await card.focus();
    await page.keyboard.press('Space');

    // Live region announcement
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toContainText(`Picked up task ${taskKey}`);

    // 2. Press ArrowRight to select next column
    await page.keyboard.press('ArrowRight');
    await expect(liveRegion).toContainText('Selected column: In Progress');

    // 3. Press Space to drop
    await page.keyboard.press('Space');
    await expect(liveRegion).toContainText(`Moved task ${taskKey} to In Progress`);

    // 4. Confirm in API response
    const res = await request.get(`/api/projects/${PROJECT_ID}/boards/${BOARD_ID}`);
    const data = await res.json();
    const inProgressCol = data.board.columns.find((c: any) => c.name === 'In Progress');
    const taskInCol = inProgressCol.tasks.find((t: any) => t.key === taskKey);
    expect(taskInCol).toBeDefined();
  });

  test('Fix 4: Mouse drag with multiple move steps, plain click opens card, API verification', async ({ page, request }) => {
    await login(page, 'developer@example.com');
    await page.goto(BOARD_URL);
    await page.waitForSelector('[data-slot="page-header"]');

    // Plain click opens card in TaskDetailsDialog
    const card = page.locator('[aria-roledescription="draggable task card"]').first();
    await card.click();
    const detailsDialog = page.locator('#task-details-dialog');
    await expect(detailsDialog).toBeVisible();
    await page.locator('#task-details-close-btn').click();
    await expect(detailsDialog).not.toBeVisible();

    // Perform mouse drag from To Do to In Progress
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();

    const inProgressCol = page.locator('h2:has-text("In Progress")').first();
    const targetBox = await inProgressCol.boundingBox();
    expect(targetBox).not.toBeNull();

    const startX = cardBox!.x + cardBox!.width / 2;
    const startY = cardBox!.y + cardBox!.height / 2;
    const endX = targetBox!.x + targetBox!.width / 2;
    const endY = targetBox!.y + 120;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Several move steps
    await page.mouse.move(startX + (endX - startX) * 0.3, startY + (endY - startY) * 0.3, { steps: 5 });
    await page.mouse.move(startX + (endX - startX) * 0.7, startY + (endY - startY) * 0.7, { steps: 5 });
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();

    // Verify card rendered in In Progress
    await page.waitForTimeout(1000);
    const res = await request.get(`/api/projects/${PROJECT_ID}/boards/${BOARD_ID}`);
    const data = await res.json();
    const col = data.board.columns.find((c: any) => c.name === 'In Progress');
    expect(col.tasks.length).toBeGreaterThan(0);
  });

  test('Fix 5: Backward move In Progress -> To Do with reason dialog, validation, bounceCount in API', async ({ page, request }) => {
    await login(page, 'developer@example.com');
    await page.goto(BOARD_URL);
    await page.waitForSelector('[data-slot="page-header"]');

    // Find card in In Progress
    const inProgressHeader = page.locator('h2:has-text("In Progress")').locator('xpath=ancestor::div[contains(@class, "w-72") or contains(@class, "sm:w-80")]');
    const cardInProgress = inProgressHeader.locator('[aria-roledescription="draggable task card"]').first();
    const taskKey = (await cardInProgress.locator('.font-mono').first().textContent())?.trim();

    const cardBox = await cardInProgress.boundingBox();
    const toDoHeader = page.locator('h2:has-text("To Do")').first();
    const toDoBox = await toDoHeader.boundingBox();

    const startX = cardBox!.x + cardBox!.width / 2;
    const startY = cardBox!.y + cardBox!.height / 2;
    const endX = toDoBox!.x + toDoBox!.width / 2;
    const endY = toDoBox!.y + 120;

    // Drag backward to To Do
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + (endX - startX) * 0.5, startY + (endY - startY) * 0.5, { steps: 5 });
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();

    // Reason dialog opens
    const dialog = page.locator('text=Send task back');
    await expect(dialog).toBeVisible();

    // Empty reason shows error
    await page.locator('#send-back-submit-btn').click();
    await expect(page.locator('text=Reason is required.')).toBeVisible();

    // Provide reason and submit
    await page.locator('#send-back-reason').fill('Login fails on mobile');
    await page.locator('#send-back-submit-btn').click();
    await expect(dialog).not.toBeVisible();

    // Verify card shows "Sent back 1 time"
    const sentBackCard = page.locator(`[data-task-key="${taskKey}"]`).first();
    await expect(sentBackCard.locator('text=Sent back 1 time')).toBeVisible();

    // Verify bounceCount in API
    const res = await request.get(`/api/projects/${PROJECT_ID}/boards/${BOARD_ID}`);
    const data = await res.json();
    const toDoCol = data.board.columns.find((c: any) => c.name === 'To Do');
    const task = toDoCol.tasks.find((t: any) => t.key === taskKey);
    expect(task.bounceCount).toBe(1);
  });

  test('Fix 6: Offline cache with context.setOffline(true) and setOffline(false)', async ({ page, context }) => {
    await login(page, 'developer@example.com');
    await page.goto(BOARD_URL);
    await page.waitForSelector('[data-slot="page-header"]');

    // Go offline and reload
    await context.setOffline(true);
    await page.reload();

    // Confirm columns and cards appear with "Showing saved data"
    const savedDataIndicator = page.locator('#saved-data-indicator');
    await expect(savedDataIndicator).toBeVisible();
    await expect(savedDataIndicator).toContainText('Showing saved data');
    const cards = page.locator('[aria-roledescription="draggable task card"], [aria-roledescription="read-only task card"]');
    expect(await cards.count()).toBeGreaterThan(0);

    // Go back online
    await context.setOffline(false);
    await page.waitForTimeout(1000);
    // Indicator clears after successful refresh
    await expect(savedDataIndicator).not.toBeVisible();
  });

  test('Fix 7: Zero hydration errors on sign-in and board pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' || text.toLowerCase().includes('hydration') || text.toLowerCase().includes('did not match')) {
        errors.push(text);
      }
    });

    await page.goto('/sign-in');
    await page.waitForSelector('#sign-in-email');
    await page.waitForTimeout(500);

    await login(page, 'developer@example.com');
    await page.goto(BOARD_URL);
    await page.waitForSelector('[data-slot="page-header"]');
    await page.waitForTimeout(500);

    const hydrationErrors = errors.filter(e => e.toLowerCase().includes('hydration') || e.toLowerCase().includes('did not match'));
    expect(hydrationErrors).toEqual([]);
  });

  test('Fix 8: Invitations heading and Expired label', async ({ page }) => {
    await login(page, 'admin@example.com');
    await page.goto('/invites');
    await page.waitForSelector('[data-slot="page-header"]');

    // Heading renamed to Invitations with active count
    const heading = page.locator('h1, [data-slot="page-header-title"]').first();
    await expect(heading).toContainText('Invitations');

    // Expired label on expired row
    const expiredBadge = page.locator('text=Expired').first();
    await expect(expiredBadge).toBeVisible();
  });
});
