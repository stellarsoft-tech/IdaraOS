import { test, expect } from "@playwright/test"

test.describe("Risk Register", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/security/risks")
  })
  
  test("should display risk register page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Risk Register" })).toBeVisible()
    await expect(page.getByText(/Identify, assess, and manage security risks/i)).toBeVisible()
  })
  
  test("should display risk stats cards", async ({ page }) => {
    // Check for stat cards
    await expect(page.getByText("High/Critical")).toBeVisible()
    await expect(page.getByText("Medium")).toBeVisible()
    await expect(page.getByText("Low")).toBeVisible()
    await expect(page.getByText("Total Risks")).toBeVisible()
  })
  
  test("should open create drawer when clicking New Risk", async ({ page }) => {
    const createButton = page.getByRole("button", { name: /new risk/i })
    await expect(createButton).toBeVisible()
    
    await createButton.click()
    
    // Drawer should open with form
    await expect(page.getByRole("heading", { name: /create risk/i })).toBeVisible()
    await expect(page.getByLabel(/title/i)).toBeVisible()
  })
  
  test("should filter risks by status", async ({ page }) => {
    // TODO: Implement filter testing when filters are exposed in UI
  })
  
  test("should sort risks by level", async ({ page }) => {
    // TODO: Implement sort testing
  })
  
  test("should navigate to risk detail on row click", async ({ page }) => {
    // Click first row
    const firstRow = page.locator("tbody tr").first()
    await firstRow.click()
    
    // Should navigate to detail page
    await expect(page).toHaveURL(/\/security\/risks\/.+/)
  })
})

