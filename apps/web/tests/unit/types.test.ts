import { describe, it, expect } from "vitest"
import { PersonSchema } from "../../lib/generated/people/person/types"

describe("Generated Types - Person", () => {
  it("should validate valid person data", () => {
    const validPerson = {
      person_id: "550e8400-e29b-41d4-a716-446655440000",
      name: "John Doe",
      email: "john@example.com",
      role: "Engineer",
      status: "active",
      start_date: "2024-01-15",
    }
    
    const result = PersonSchema.safeParse(validPerson)
    expect(result.success).toBe(true)
  })
  
  it("should reject invalid email", () => {
    const invalidPerson = {
      person_id: "550e8400-e29b-41d4-a716-446655440000",
      name: "John Doe",
      email: "invalid-email",
      role: "Engineer",
      status: "active",
      start_date: "2024-01-15",
    }
    
    const result = PersonSchema.safeParse(invalidPerson)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("email")
    }
  })
  
  it("should require name", () => {
    const invalidPerson = {
      person_id: "550e8400-e29b-41d4-a716-446655440000",
      name: "",
      email: "john@example.com",
      role: "Engineer",
      status: "active",
      start_date: "2024-01-15",
    }
    
    const result = PersonSchema.safeParse(invalidPerson)
    expect(result.success).toBe(false)
  })
  
  it("should allow team to be optional", () => {
    const validPerson = {
      person_id: "550e8400-e29b-41d4-a716-446655440000",
      name: "John Doe",
      email: "john@example.com",
      role: "Engineer",
      status: "active",
      start_date: "2024-01-15",
      // team is optional
    }
    
    const result = PersonSchema.safeParse(validPerson)
    expect(result.success).toBe(true)
  })
})

// Risk schema tests removed - security/isms/risk generated types deprecated in favor of lib/db/schema/security.ts
