import { describe, it, expect } from "vitest"
import { PersonSchema } from "../../lib/generated/people/person/types"
import { RiskSchema } from "../../lib/generated/security/isms/risk/types"

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

describe("Generated Types - Risk", () => {
  it("should validate valid risk data", () => {
    const validRisk = {
      risk_id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Data Breach Risk",
      owner_id: "660e8400-e29b-41d4-a716-446655440001",
      likelihood: "high",
      impact: "high",
      level: "high",
      status: "open",
    }
    
    const result = RiskSchema.safeParse(validRisk)
    expect(result.success).toBe(true)
  })
  
  it("should reject invalid likelihood", () => {
    const invalidRisk = {
      risk_id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Data Breach Risk",
      owner_id: "660e8400-e29b-41d4-a716-446655440001",
      likelihood: "super-high", // Invalid
      impact: "high",
      level: "high",
      status: "open",
    }
    
    const result = RiskSchema.safeParse(invalidRisk)
    expect(result.success).toBe(false)
  })
  
  it("should require title", () => {
    const invalidRisk = {
      risk_id: "550e8400-e29b-41d4-a716-446655440000",
      title: "",
      owner_id: "660e8400-e29b-41d4-a716-446655440001",
      likelihood: "high",
      impact: "high",
      level: "high",
      status: "open",
    }
    
    const result = RiskSchema.safeParse(invalidRisk)
    expect(result.success).toBe(false)
  })
  
  it("should make description optional", () => {
    const validRisk = {
      risk_id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Data Breach Risk",
      owner_id: "660e8400-e29b-41d4-a716-446655440001",
      likelihood: "high",
      impact: "high",
      level: "high",
      status: "open",
      // description is optional
    }
    
    const result = RiskSchema.safeParse(validRisk)
    expect(result.success).toBe(true)
  })
})
