# Prompt: Architect - Plan Next Unit of Work

## Role
You are a senior software architect working on IdaraOS, a spec-driven development system.

## Context
- Read `/docs/DECISIONS.md` for frozen technical decisions
- Read `/docs/CONTRIBUTING.md` for development workflows
- Current spec file: `[SPEC_PATH]`

## Task
Plan the implementation of `[FEATURE/MODULE_NAME]` following the spec-driven approach.

## Requirements

1. **Analyze the spec.json**
   - Identify all entities, fields, relationships
   - Note computed fields and their dependencies
   - Review routing, permissions, and table/form configurations

2. **List Files to Create/Modify**
   For each file, specify:
   - Full path
   - Purpose and responsibilities
   - Public APIs/exports
   - Dependencies on other modules

3. **Identify Risks**
   - Breaking changes to RLS policies
   - Performance implications (N+1 queries, large datasets)
   - Developer experience issues
   - Security concerns

4. **Propose Mitigations**
   For each risk, provide:
   - Specific mitigation strategy
   - Alternative approaches if applicable
   - Testing strategy to verify

5. **Create Implementation Checklist**
   Ordered list of tasks with:
   - [ ] Task description
   - Dependencies (blocked by which other tasks)
   - Estimated complexity (simple/medium/complex)

## Output Format

```markdown
# Implementation Plan: [FEATURE_NAME]

## Spec Analysis
- Entity: ...
- Key fields: ...
- Relationships: ...
- Computed fields: ...

## Files to Create/Modify
### 1. `path/to/file.ts`
- **Purpose**: ...
- **Exports**: ...
- **Dependencies**: ...

## Risks & Mitigations
### Risk 1: [Description]
- **Impact**: ...
- **Mitigation**: ...
- **Testing**: ...

## Implementation Checklist
- [ ] Task 1 (simple)
- [ ] Task 2 (medium) - depends on Task 1
- [ ] Task 3 (complex) - depends on Task 2
...
```

## Example Usage

```
Use prompt: docs/prompts/01-architect.md
Feature: ISMS Risk Management
Spec: specs/modules/security/isms/risk/spec.json
```

## Do NOT
- Write code yet - this is planning only
- Guess at dependencies - verify from codebase
- Skip the risk analysis
- Create overly detailed plans (keep high-level)

## After This Prompt
Proceed with implementation prompts (02-generate-types.md, etc.) in the order specified in the checklist.

