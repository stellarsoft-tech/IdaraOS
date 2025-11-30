# Prompt: Generate Form Config from Spec

## Role
You are generating form field configurations for schema-driven forms.

## Context
- Input: `[SPEC_PATH]` (spec.json file)
- Output: `apps/web/lib/generated/[module]/form-config.ts`
- Reference: Generated types and FormBuilder component

## Task
Generate form field configurations that map spec fields to UI components.

## Requirements

1. **Run the Generator**
   ```bash
   pnpm generate [SPEC_PATH]
   ```

2. **Verify Generated Config**
   Check `apps/web/lib/generated/[module]/form-config.ts`:
   - All fields from `spec.forms.create` and `spec.forms.edit` are present
   - Component types match field types
   - Required fields are marked
   - Enum fields have options arrays
   - Reference fields have loadOptions stubs

3. **Component Mapping**
   - string → input
   - text → textarea
   - number → input[type=number]
   - boolean → switch
   - date → date-picker
   - datetime → datetime-picker
   - enum → select with options
   - uuid + ref → async-select

4. **Manual Enhancements** (if needed)
   - Implement `loadOptions` for reference fields
   - Add conditional field visibility
   - Add field-level validation messages
   - Customize placeholder text

## Example Form Config

```typescript
export const formConfig = {
  title: {
    component: "input",
    label: "Title",
    placeholder: "Enter risk title",
    required: true,
    helpText: "A clear, concise description of the risk"
  },
  owner_id: {
    component: "async-select",
    label: "Owner",
    placeholder: "Search for owner",
    required: true,
    ref: "people.person",
    loadOptions: async (search: string) => {
      // TODO: Implement API call
      const response = await fetch(`/api/people?search=${search}`)
      const data = await response.json()
      return data.map((person) => ({
        value: person.id,
        label: person.name
      }))
    }
  },
  status: {
    component: "select",
    label: "Status",
    placeholder: "Select status",
    required: true,
    options: [
      { value: "open", label: "Open" },
      { value: "mitigating", label: "Mitigating" },
      { value: "accepted", label: "Accepted" },
      { value: "closed", label: "Closed" }
    ]
  }
}
```

## Usage in Component

```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { createRiskSchema, formConfig } from "@/lib/generated/security/isms/risk"

function CreateRiskButton() {
  const [open, setOpen] = useState(false)
  
  const handleSubmit = async (data) => {
    await createRisk(data)
  }
  
  return (
    <>
      <Button onClick={() => setOpen(true)}>Create Risk</Button>
      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        title="Create Risk"
        schema={createRiskSchema}
        config={formConfig}
        fields={["title", "owner_id", "likelihood", "impact", "description"]}
        mode="create"
        onSubmit={handleSubmit}
      />
    </>
  )
}
```

## Conditional Fields

For fields that should only show based on other field values:

```typescript
// In component (not generated)
const relevantFields = React.useMemo(() => {
  const base = ["title", "owner_id"]
  if (watchFieldValue === "some_value") {
    base.push("conditional_field")
  }
  return base
}, [watchFieldValue])

<FormDrawer
  fields={relevantFields}
  ...
/>
```

## Output Format

```markdown
✅ Generated form config for [entity_name]

**Files created:**
- apps/web/lib/generated/[module]/form-config.ts

**Form modes:**
- create: [list of fields]
- edit: [list of fields]

**Component mappings:**
- [field1]: input (text)
- [field2]: select (enum)
- [field3]: async-select (reference)
- [field4]: textarea (long text)

**Manual implementations needed:**
- [ ] None
OR
- [ ] Implement loadOptions for [ref_field]
- [ ] Add conditional visibility for [field]
- [ ] Custom validation for [complex_field]
```

## Example Usage

```
Use prompt: docs/prompts/05-generate-form.md
Spec: specs/modules/security/isms/risk/spec.json
```

## Do NOT
- Edit generated config directly (regenerate from spec)
- Forget to implement loadOptions for reference fields
- Skip helpText for complex fields
- Use generic placeholders ("Enter value")

## Next Steps
1. Implement loadOptions for reference fields
2. Test create and edit modes
3. Verify validation works
4. Proceed to 06-generate-routes.md

