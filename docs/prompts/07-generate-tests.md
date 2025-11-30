# Prompt: Generate E2E Tests

## Role
You are writing end-to-end tests for a new module using Playwright.

## Context
- Input: `[SPEC_PATH]` and generated pages
- Output: `tests/e2e/[module]/[entity].spec.ts`
- Tool: Playwright for E2E testing

## Task
Generate comprehensive E2E tests covering happy paths and edge cases.

## Requirements

### Test Structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('[Entity] Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to list page
    await page.goto('[list_route]')
    // TODO: Login if needed
  })
  
  test('should display list page', async ({ page }) => {
    await expect(page).toHaveTitle(/[Entity Plural]/)
    await expect(page.getByRole('heading', { name: '[Entity Plural]' })).toBeVisible()
  })
  
  test('should create new [entity]', async ({ page }) => {
    // Click create button
    await page.getByRole('button', { name: /new [entity]/i }).click()
    
    // Fill form
    await page.getByLabel('[Field 1]').fill('Test Value')
    await page.getByLabel('[Field 2]').selectOption('option1')
    // ... fill all required fields
    
    // Submit
    await page.getByRole('button', { name: /create/i }).click()
    
    // Verify success
    await expect(page.getByText(/created successfully/i)).toBeVisible()
    await expect(page).toHaveURL(/[detail_route]/)
  })
  
  test('should validate required fields', async ({ page }) => {
    await page.getByRole('button', { name: /new [entity]/i }).click()
    
    // Try to submit without filling required fields
    await page.getByRole('button', { name: /create/i }).click()
    
    // Verify validation errors
    await expect(page.getByText(/[field] is required/i)).toBeVisible()
  })
  
  test('should edit existing [entity]', async ({ page }) => {
    // Navigate to detail page (assumes entity exists)
    await page.goto('[detail_route]/[test_id]')
    
    // Click edit button
    await page.getByRole('button', { name: /edit/i }).click()
    
    // Modify fields
    await page.getByLabel('[Field 1]').fill('Updated Value')
    
    // Submit
    await page.getByRole('button', { name: /save/i }).click()
    
    // Verify success
    await expect(page.getByText(/updated successfully/i)).toBeVisible()
    await expect(page.getByText('Updated Value')).toBeVisible()
  })
  
  test('should filter list', async ({ page }) => {
    // Apply filter
    await page.getByPlaceholder(/search/i).fill('test query')
    
    // Verify filtered results
    // (depends on your data)
  })
  
  test('should sort list', async ({ page }) => {
    // Click sort header
    await page.getByRole('button', { name: '[Column]' }).click()
    
    // Verify sort order
    // (depends on your data)
  })
  
  test('should export to CSV', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download')
    
    // Click export button
    await page.getByRole('button', { name: /export/i }).click()
    
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/export-.*\.csv/)
  })
  
  test('should delete [entity]', async ({ page }) => {
    await page.goto('[detail_route]/[test_id]')
    
    // Click delete button
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: /delete/i }).click()
    
    // Verify redirect and success
    await expect(page).toHaveURL('[list_route]')
    await expect(page.getByText(/deleted successfully/i)).toBeVisible()
  })
})
```

### Test Data Setup

```typescript
// tests/fixtures/[entity].ts
export const test[Entity]Data = {
  valid: {
    [field1]: 'Test Value',
    [field2]: 'option1',
    ...
  },
  invalid: {
    [field1]: '', // Missing required
    [field2]: 'invalid_option',
    ...
  }
}
```

## Coverage Checklist

- [ ] List page loads
- [ ] Create new entity (happy path)
- [ ] Create validation (required fields)
- [ ] Create validation (format/type errors)
- [ ] Edit existing entity
- [ ] Delete entity (with confirmation)
- [ ] Search/filter functionality
- [ ] Sort functionality
- [ ] Pagination (if applicable)
- [ ] Column visibility toggle
- [ ] CSV export
- [ ] Navigation (list ↔ detail)
- [ ] Breadcrumbs work
- [ ] Error states (network errors)
- [ ] Permission checks (if applicable)

## Output Format

```markdown
✅ Generated E2E tests for [entity_name]

**Files created:**
- tests/e2e/[module]/[entity].spec.ts
- tests/fixtures/[entity].ts (optional)

**Test scenarios:**
- List page display
- Create entity (valid)
- Create entity (validation)
- Edit entity
- Delete entity (with confirmation)
- Search/filter
- Sort
- Export CSV
- Navigation

**Coverage:**
- [X]% of user flows
- [X] critical paths
- [X] edge cases

**TODO:**
- [ ] Add test data seeding
- [ ] Add teardown (cleanup test entities)
- [ ] Add visual regression tests (optional)
```

## Running Tests

```bash
# Run all tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e tests/e2e/[module]/[entity].spec.ts

# Run in UI mode
pnpm test:e2e --ui

# Run in headed mode (see browser)
pnpm test:e2e --headed
```

## Example Usage

```
Use prompt: docs/prompts/07-generate-tests.md
Spec: specs/modules/security/isms/risk/spec.json
Pages: [list_route], [detail_route]
```

## Do NOT
- Test implementation details (test user behavior)
- Hard-code test data in tests (use fixtures)
- Skip cleanup (delete created entities)
- Forget to handle async operations
- Skip error scenarios

## Next Steps
1. Run tests locally
2. Fix any failures
3. Add to CI pipeline
4. Proceed to 08-critique.md

