# Prompt: Generate Types + Zod from Spec

## Role
You are a code generator creating type-safe TypeScript code from JSON specifications.

## Context
- Input: `[SPEC_PATH]` (spec.json file)
- Output: `apps/web/lib/generated/[module]/types.ts`
- Reference: `/docs/DECISIONS.md` for approved patterns

## Task
Generate Zod schemas and TypeScript types from the provided spec.json file.

## Requirements

1. **Run the Generator**
   ```bash
   pnpm generate [SPEC_PATH]
   ```

2. **Verify Generated Types**
   Check `apps/web/lib/generated/[module]/types.ts`:
   - Zod schema includes all non-computed fields
   - Validation rules match spec (email, min/max, regex)
   - Enum values are correct
   - Required vs optional fields are accurate
   - Create/update schemas omit appropriate fields

3. **Manual Refinements** (if needed)
   - Add custom validation logic
   - Refine computed field types
   - Add JSDoc comments for complex types
   - Create union types for related entities

4. **Test the Types**
   ```typescript
   import { personSchema, createPersonSchema } from './types'
   
   // Valid data
   const valid = personSchema.parse({...})
   
   // Invalid data (should throw)
   try {
     personSchema.parse({...})
   } catch (error) {
     // Verify error messages are helpful
   }
   ```

## Common Issues

### Issue: Enum values don't match database
**Fix**: Update spec.json values array, regenerate

### Issue: Optional field marked as required
**Fix**: Set `required: false` in spec.json, regenerate

### Issue: Validation too strict/loose
**Fix**: Adjust validation rules in spec.json, regenerate

## Output Format

After generation, report:

```markdown
✅ Generated types for [entity_name]

**Files created:**
- apps/web/lib/generated/[module]/types.ts

**Schemas:**
- [entity]Schema: Main entity schema
- create[Entity]Schema: For create operations
- update[Entity]Schema: For update operations

**Validation rules applied:**
- Email validation on [field]
- Min length (3) on [field]
- Enum constraint on [field]

**Manual refinements needed:**
- [ ] None
OR
- [ ] Add custom validation for [specific case]
- [ ] Refine [computed_field] type
```

## Example Usage

```
Use prompt: docs/prompts/02-generate-types.md
Spec: specs/modules/people/person/spec.json
```

## Do NOT
- Edit generated files directly (edit spec.json instead)
- Skip validation testing
- Ignore TypeScript errors

## Next Steps
1. Fix any TypeScript compilation errors
2. Proceed to 04-generate-columns.md

