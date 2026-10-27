# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-review.spec.ts >> Board Review & UI Fixes >> Fix 1 & 2: Read-only cards for Admin on Developer columns and refused move message
- Location: e2e/board-review.spec.ts:16:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('#email-input')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - main [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e22]: Client Laboratory
        - heading "Medmylife Laboratory" [level=2] [ref=e23]
        - paragraph [ref=e24]: "& Diagnostics Center"
        - paragraph [ref=e26]: NABL & ISO Accredited Pathology & Medical Diagnostics Network. Empowering precise clinical analysis and real-time specimen tracking.
        - generic [ref=e27]: LIMS Analyzer Interfacing Active
      - generic [ref=e30]:
        - generic [ref=e31]:
          - generic [ref=e32]:
            - heading "System Sign In" [level=3] [ref=e37]
            - paragraph [ref=e38]: Enter your platform email & password to access the dashboard
          - generic [ref=e39]:
            - generic [ref=e40]:
              - generic [ref=e41]: Email
              - textbox "you@firstmedix.in" [ref=e46]
            - generic [ref=e47]:
              - generic [ref=e48]: Password
              - generic [ref=e49]:
                - textbox "Enter password" [ref=e53]
                - button "Show password" [ref=e54] [cursor=pointer]
            - button "Login to Dashboard" [ref=e58] [cursor=pointer]
        - generic [ref=e62]: Uses your ClickMeds platform account. Requires the LIMS module enabled on at least one clinic.
      - generic [ref=e63]:
        - generic [ref=e68]: Software Provider
        - heading "Firstmedix" [level=2] [ref=e69]
        - paragraph [ref=e70]: Healthcare Systems & LIMS
        - paragraph [ref=e72]: Next-Generation Laboratory Information Management Platform. Built for hospital networks, high-throughput pathology, and diagnostic centers.
        - generic [ref=e73]: HIPAA & NABL Cyber Compliant
  - contentinfo [ref=e78]:
    - generic [ref=e79]:
      - generic [ref=e80]: software made with
      - generic [ref=e81]: ❤️
      - generic [ref=e82]: "@copyright Firstmedix.com"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const PROJECT_ID = 'cmuyixhhg000eua0rlm5fl9xw';
  4   | const BOARD_ID = `demo-board-${PROJECT_ID}`;
  5   | const BOARD_URL = `/projects/${PROJECT_ID}/boards/${BOARD_ID}`;
  6   | 
  7   | async function login(page: any, email: string, pass: string = 'development123') {
  8   |   await page.goto('/sign-in');
> 9   |   await page.fill('#email-input', email);
      |              ^ Error: page.fill: Test timeout of 60000ms exceeded.
  10  |   await page.fill('#password-input', pass);
  11  |   await page.click('button[type="submit"]');
  12  |   await page.waitForURL((url: URL) => !url.pathname.includes('/sign-in'), { timeout: 15000 });
  13  | }
  14  | 
  15  | test.describe('Board Review & UI Fixes', () => {
  16  |   test('Fix 1 & 2: Read-only cards for Admin on Developer columns and refused move message', async ({ page }) => {
  17  |     await login(page, 'admin@example.com');
  18  |     await page.goto(BOARD_URL);
  19  |     await page.waitForSelector('[data-slot="page-header"]');
  20  | 
  21  |     // Confirm To Do column header displays the move rule
  22  |     const toDoHeaderNotice = page.locator('text=Only Developers can move tasks out of this column.').first();
  23  |     await expect(toDoHeaderNotice).toBeVisible();
  24  | 
  25  |     // Check that cards in To Do are read-only
  26  |     const firstCard = page.locator('[aria-roledescription="read-only task card"]').first();
  27  |     await expect(firstCard).toBeVisible();
  28  | 
  29  |     // Focus and press Space on read-only card to verify refusal message
  30  |     await firstCard.focus();
  31  |     await page.keyboard.press('Space');
  32  | 
  33  |     // Confirm exact refused move banner
  34  |     const banner = page.locator('text=You can\'t move this task out of To Do. Only Developers can move tasks out of this column. Ask a Developer to move it, or ask an administrator to change the column\'s rules.');
  35  |     await expect(banner).toBeVisible();
  36  |   });
  37  | 
  38  |   test('Fix 3: Keyboard move with Space and ArrowRight, screen reader announcements and API verification', async ({ page, request }) => {
  39  |     await login(page, 'developer@example.com');
  40  |     await page.goto(BOARD_URL);
  41  |     await page.waitForSelector('[data-slot="page-header"]');
  42  | 
  43  |     // Pick first movable card in To Do
  44  |     const card = page.locator('[aria-roledescription="draggable task card"]').first();
  45  |     const taskKey = await card.locator('.font-mono').first().textContent();
  46  |     expect(taskKey).toBeTruthy();
  47  | 
  48  |     // 1. Focus card and press Space to pick up
  49  |     await card.focus();
  50  |     await page.keyboard.press('Space');
  51  | 
  52  |     // Live region announcement
  53  |     const liveRegion = page.locator('[aria-live="polite"]');
  54  |     await expect(liveRegion).toContainText(`Picked up task ${taskKey}`);
  55  | 
  56  |     // 2. Press ArrowRight to select next column
  57  |     await page.keyboard.press('ArrowRight');
  58  |     await expect(liveRegion).toContainText('Selected column: In Progress');
  59  | 
  60  |     // 3. Press Space to drop
  61  |     await page.keyboard.press('Space');
  62  |     await expect(liveRegion).toContainText(`Moved task ${taskKey} to In Progress`);
  63  | 
  64  |     // 4. Confirm in API response
  65  |     const res = await request.get(`/api/projects/${PROJECT_ID}/boards/${BOARD_ID}`);
  66  |     const data = await res.json();
  67  |     const inProgressCol = data.board.columns.find((c: any) => c.name === 'In Progress');
  68  |     const taskInCol = inProgressCol.tasks.find((t: any) => t.key === taskKey);
  69  |     expect(taskInCol).toBeDefined();
  70  |   });
  71  | 
  72  |   test('Fix 4: Mouse drag with multiple move steps, plain click opens card, API verification', async ({ page, request }) => {
  73  |     await login(page, 'developer@example.com');
  74  |     await page.goto(BOARD_URL);
  75  |     await page.waitForSelector('[data-slot="page-header"]');
  76  | 
  77  |     // Plain click opens card in TaskDetailsDialog
  78  |     const card = page.locator('[aria-roledescription="draggable task card"]').first();
  79  |     await card.click();
  80  |     const detailsDialog = page.locator('#task-details-dialog');
  81  |     await expect(detailsDialog).toBeVisible();
  82  |     await page.locator('#task-details-close-btn').click();
  83  |     await expect(detailsDialog).not.toBeVisible();
  84  | 
  85  |     // Perform mouse drag from To Do to In Progress
  86  |     const cardBox = await card.boundingBox();
  87  |     expect(cardBox).not.toBeNull();
  88  | 
  89  |     const inProgressCol = page.locator('h2:has-text("In Progress")').first();
  90  |     const targetBox = await inProgressCol.boundingBox();
  91  |     expect(targetBox).not.toBeNull();
  92  | 
  93  |     const startX = cardBox!.x + cardBox!.width / 2;
  94  |     const startY = cardBox!.y + cardBox!.height / 2;
  95  |     const endX = targetBox!.x + targetBox!.width / 2;
  96  |     const endY = targetBox!.y + 120;
  97  | 
  98  |     await page.mouse.move(startX, startY);
  99  |     await page.mouse.down();
  100 |     // Several move steps
  101 |     await page.mouse.move(startX + (endX - startX) * 0.3, startY + (endY - startY) * 0.3, { steps: 5 });
  102 |     await page.mouse.move(startX + (endX - startX) * 0.7, startY + (endY - startY) * 0.7, { steps: 5 });
  103 |     await page.mouse.move(endX, endY, { steps: 5 });
  104 |     await page.mouse.up();
  105 | 
  106 |     // Verify card rendered in In Progress
  107 |     await page.waitForTimeout(1000);
  108 |     const res = await request.get(`/api/projects/${PROJECT_ID}/boards/${BOARD_ID}`);
  109 |     const data = await res.json();
```