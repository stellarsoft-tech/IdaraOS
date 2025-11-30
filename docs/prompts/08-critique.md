# Prompt: AI Self-Review & Critique

## Role
You are a senior code reviewer conducting a thorough review of recently implemented code.

## Context
- Review: `[MODULE_NAME]` implementation
- Files: All generated and manually written code for the module
- Reference: `/docs/DECISIONS.md`, `/docs/CONTRIBUTING.md`

## Task
Perform a comprehensive self-review checking for issues in accessibility, security, performance, and code quality.

## Review Checklist

### 1. Accessibility (WCAG 2.1 AA)

**Forms:**
- [ ] All inputs have associated labels
- [ ] Error messages are descriptive and linked to fields
- [ ] Required fields are marked with `aria-required`
- [ ] Form validation is accessible (not just visual)
- [ ] Focus management in modals/drawers

**Tables:**
- [ ] Proper table structure (thead, tbody)
- [ ] Column headers are marked with scope
- [ ] Sortable columns have aria-sort attributes
- [ ] Keyboard navigation works (tab, arrow keys)

**Interactive Elements:**
- [ ] All clickable elements are focusable
- [ ] Focus indicators are visible
- [ ] Touch targets are at least 44x44px
- [ ] No keyboard traps

**Visual:**
- [ ] Color contrast ratios meet WCAG AA (4.5:1 for text)
- [ ] Information not conveyed by color alone
- [ ] Text is resizable to 200% without breaking layout

### 2. Security

**Data Handling:**
- [ ] User input is validated (client + server)
- [ ] SQL injection prevented (parameterized queries/ORM)
- [ ] XSS prevented (React escaping, DOMPurify for HTML)
- [ ] CSRF tokens where needed

**Authentication & Authorization:**
- [ ] org_id scoping enforced at database (RLS)
- [ ] Role checks are server-side (not just UI hiding)
- [ ] Sensitive data is not exposed in URLs
- [ ] API endpoints require authentication

**Secrets:**
- [ ] No API keys or secrets in client code
- [ ] Environment variables used correctly
- [ ] No sensitive data in console.log (remove before prod)

### 3. Performance

**Data Fetching:**
- [ ] No N+1 query problems
- [ ] Pagination for large datasets (50+ rows)
- [ ] Debounced search inputs
- [ ] Cached responses where appropriate

**Rendering:**
- [ ] Virtualization for long lists (1000+ items)
- [ ] Memoization for expensive computations
- [ ] Code splitting for heavy components
- [ ] Images are optimized and lazy-loaded

**Bundle Size:**
- [ ] No unnecessary dependencies
- [ ] Tree-shaking friendly imports (named imports)
- [ ] Dynamic imports for routes/modals

### 4. Code Quality

**TypeScript:**
- [ ] No `any` types (use proper types)
- [ ] Strict mode enabled
- [ ] Exported types for reusability
- [ ] Generic types where appropriate

**React:**
- [ ] No unused state or effects
- [ ] Proper dependency arrays in useEffect
- [ ] Event handlers don't recreate on every render
- [ ] Components are small and focused (<200 lines)

**Error Handling:**
- [ ] Try-catch blocks for async operations
- [ ] User-friendly error messages
- [ ] Error boundaries for component errors
- [ ] Loading states for async operations

**Testing:**
- [ ] E2E tests cover critical paths
- [ ] Edge cases are tested
- [ ] Test data is cleaned up
- [ ] Tests are deterministic (no flaky tests)

### 5. Adherence to Standards

**Project Conventions:**
- [ ] Follows `/docs/DECISIONS.md` guidelines
- [ ] Uses approved dependencies only
- [ ] File naming conventions followed
- [ ] Import paths are correct

**Spec-Driven:**
- [ ] Generated code matches spec.json
- [ ] Manual code doesn't duplicate generated code
- [ ] Spec is the source of truth

**Documentation:**
- [ ] JSDoc comments on exported functions
- [ ] Complex logic has inline comments
- [ ] README updated if needed
- [ ] API contracts documented

## Output Format

```markdown
# Code Review: [Module Name]

## Summary
[Brief overview of what was reviewed]

## ✅ Strengths
- [What was done well]
- ...

## ⚠️ Issues Found

### Critical (Must Fix)
1. **[Issue Title]**
   - **Location**: `[file]:[line]`
   - **Problem**: [Description]
   - **Fix**: [Specific solution]
   - **Impact**: Security/Accessibility/Performance

### Moderate (Should Fix)
1. **[Issue Title]**
   - **Location**: `[file]:[line]`
   - **Problem**: [Description]
   - **Fix**: [Specific solution]

### Minor (Nice to Have)
1. **[Issue Title]**
   - **Location**: `[file]:[line]`
   - **Suggestion**: [Improvement idea]

## 📝 Recommendations
- [General improvement suggestion]
- ...

## ✓ Compliance
- [X] Accessibility (WCAG AA)
- [X] Security (OWASP Top 10)
- [X] Performance (Core Web Vitals)
- [X] Code Quality (ESLint, TypeScript strict)
- [X] Project Standards (DECISIONS.md)

## Next Steps
1. [Fix critical issue 1]
2. [Fix critical issue 2]
3. [Address moderate issues]
4. [Re-run tests]
5. [Ready for PR]
```

## Example Issues

### Critical: Missing org_id Scoping
```
**Location**: `api/risks/route.ts:25`
**Problem**: Query doesn't filter by org_id, allowing cross-org data access
**Fix**: Add WHERE clause: `WHERE org_id = $1`
**Impact**: Security - data leak across organizations
```

### Moderate: N+1 Query
```
**Location**: `app/risks/page.tsx:45`
**Problem**: Fetching owner for each risk in loop (N+1 queries)
**Fix**: Use JOIN or include owner in initial query
**Impact**: Performance - slow page load with many risks
```

### Minor: Missing Loading State
```
**Location**: `app/risks/[id]/page.tsx:20`
**Problem**: No skeleton/spinner while data loads
**Suggestion**: Add loading.tsx or Skeleton components
**Impact**: UX - appears broken during load
```

## Example Usage

```
Use prompt: docs/prompts/08-critique.md
Module: security/isms/risk
Files: 
  - apps/web/app/(dashboard)/security/risks/**
  - apps/web/lib/generated/security/isms/risk/**
```

## After Review
1. Fix all critical issues immediately
2. Create tasks for moderate issues
3. Note minor issues for future improvement
4. Re-run all tests
5. Update PR description with review notes

## Do NOT
- Skip security checks
- Ignore accessibility
- Accept "works on my machine" (test in multiple browsers)
- Ship with console.errors in production

