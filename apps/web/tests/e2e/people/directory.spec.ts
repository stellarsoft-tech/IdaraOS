import { test, expect } from "@playwright/test"

test.describe("People Directory", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/people/directory")
  })
  
  test("should display directory page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Directory" })).toBeVisible()
    await expect(page.getByText(/View and manage all employees/i)).toBeVisible()
  })
  
  test("should have search functionality", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search people/i)
    await expect(searchInput).toBeVisible()
    
    // Type in search
    await searchInput.fill("test")
    
    // Results should filter (depends on data)
  })
  
  test("should open create drawer when clicking Add Person", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /add person/i })
    await expect(addButton).toBeVisible()
    
    await addButton.click()
    
    // Drawer should open
    await expect(page.getByRole("heading", { name: /add person/i })).toBeVisible()
  })
  
  test("should show column visibility toggle", async ({ page }) => {
    const columnsButton = page.getByRole("button", { name: /columns/i })
    await expect(columnsButton).toBeVisible()
  })
  
  test("should export to CSV", async ({ page }) => {
    const exportButton = page.getByRole("button", { name: /export/i })
    await expect(exportButton).toBeVisible()
    
    // TODO: Test actual CSV download
  })
  
  test("should navigate to detail page on row click", async ({ page }) => {
    // Click first row (if data exists)
    const firstRow = page.locator("tbody tr").first()
    await firstRow.click()
    
    // Should navigate to detail page
    await expect(page).toHaveURL(/\/people\/directory\/.+/)
  })
})

