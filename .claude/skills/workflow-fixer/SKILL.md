---
name: workflow-fixer
description: "YOU MUST USE THIS SKILL when the user needs to DEBUG, FIX, or VALIDATE an existing workflow. Activate for requests like: 'workflow is failing', 'validation error', 'fix my workflow', 'debug workflow', 'error: [message]', 'workflow not working', 'test my workflow'. This skill focuses on error diagnosis, validation troubleshooting, and workflow debugging. For CREATING new workflows, use the workflow-builder skill instead."
---

# Workflow Fixer

**For creating workflows**: Use `/workflow`

---

## Validation Pipeline

**REQUIRED - always run in order:**
```bash
# 1. Validate structure, modules, and workflow correctness (comprehensive AJV validation)
npm run validate workflow/{name}.json

# 2. Test execution
npx tsx scripts/test-workflow.ts workflow/{name}.json

# 3. Import to database
npx tsx scripts/import-workflow.ts workflow/{name}.json
```

**New validation system**:
- Uses AJV for fast JSON Schema validation
- Validates module paths against actual source files
- Checks variable references and data flow
- Provides detailed error messages with fix suggestions

**For incremental fixes, use JSON Patch**:
```bash
npm run patch workflow/{name}.json fix-patch.json --write
```

Example patch file:
```json
[
  {
    "op": "replace",
    "path": "/config/steps/0/module",
    "value": "correct.module.name"
  }
]
```

---

## Common Errors & Solutions

### Module Errors

**"Module not found"**
- Re-search with different keywords: `npm run search <keyword> -- --limit 5`
- Check lowercase: `social.twitter` not `Social.Twitter`
- For JSON output: `npm run search <keyword> -- --format json --limit 5`

**"Function not found"**
- Registry out of sync: `npm run generate:registry`
- Check source: `cat src/modules/{category}/{module}.ts`

### AI SDK Errors

**"options undefined"**
- AI SDK ALWAYS needs `{"options": {...}}`
- ❌ `"inputs": {"prompt": "..."}`
- ✅ `"inputs": {"options": {"prompt": "..."}}`

**"maxTokens < 16"**
- OpenAI requires ≥16 tokens
- Set `"maxTokens": 20` or higher

**String functions fail**
- AI returns objects, not strings
- ❌ `{{aiOutput}}`
- ✅ `{{aiOutput.content}}`

### Variable Errors

**"Variable undefined"**
- Check `outputAs` in previous step
- Use `{{outputAs}}` NOT `{{stepId.outputAs}}`
- Must declare before use

### Array/Data Errors

**"All fields must be arrays" (zipToObjects)**
- ❌ `"fields": "{{text}}"` (creates char array)
- ✅ `"fields": ["{{item1}}", "{{item2}}"]`
- ALL fields need equal-length arrays

### Credential Errors

**"credential.X undefined"**
- Check exact name: `grep "credential\." workflow/*.json`
- Common: `openai_api_key`, `twitter_oauth`, `rapidapi_api_key`
- List in metadata: `"requiresCredentials": ["service"]`

**"Unauthorized"**
- Credential expired or incorrect
- User must update in settings
- OAuth auto-refreshes (Twitter, YouTube, GitHub)

### Validation Errors

**"returnValue at config level"**
- ❌ Inside `outputDisplay`
- ✅ Same level as `steps` and `outputDisplay`

**Trigger Configuration Errors:**

**"chat trigger missing inputVariable"**
```json
// ❌ WRONG
"trigger": { "type": "chat", "config": {} }

// ✅ CORRECT
"trigger": { "type": "chat", "config": { "inputVariable": "userMessage" } }
```

**"cron trigger missing schedule"**
```json
// ❌ WRONG - Missing required schedule
"trigger": { "type": "cron", "config": {} }

// ✅ CORRECT - Add sensible default
"trigger": {
  "type": "cron",
  "config": {
    "schedule": "0 9 * * *"
  }
}
```
**Fix**: Add a default schedule in JSON. Users will adjust via easy UI dropdown (not cron syntax).

Defaults by workflow type: Daily = `"0 9 * * *"`, Hourly = `"0 * * * *"`, Frequent = `"*/15 * * * *"`

Users select from dropdown: "Every 5 minutes", "Daily at 9 AM", "Weekly", etc.

**"chat-input fields missing required properties"**
```json
// Each field MUST have:
{
  "id": "1",           // Required: unique ID
  "label": "Name",     // Required: display label
  "key": "fieldName",  // Required: variable key
  "type": "text",      // Required: text|textarea|number|date|select
  "required": true     // Required: boolean
}

// For select type, MUST include:
"options": ["Option 1", "Option 2"]
```

**"gmail/outlook trigger missing config"**
```json
"config": {
  "filters": {
    "label": "inbox",   // Optional
    "isUnread": true    // Optional
  },
  "pollInterval": 60  // Required: seconds (60 = 1 min, 300 = 5 min)
}
```
Access trigger data: `{{trigger.userId}}`, `{{trigger.email.id}}`

**Output Display Type Mismatch Errors:**

**"Table display requires array, got object"**
```json
// ❌ WRONG - AI SDK returns object
"returnValue": "{{aiOutput}}",
"outputDisplay": { "type": "table" }

// ✅ FIX 1 - Wrap in array
"returnValue": "[{{aiOutput}}]",
"outputDisplay": { "type": "table", "columns": [...] }

// ✅ FIX 2 - Use forEach to generate array
{
  "id": "createArray",
  "module": "utilities.array-utils.fill",
  "inputs": { "length": 1, "value": "{{aiOutput}}" },
  "outputAs": "resultArray"
}
```

**"Text display requires string, got object"**
```json
// ❌ WRONG - AI returns {content: "...", usage: {...}}
"returnValue": "{{aiOutput}}",
"outputDisplay": { "type": "text" }

// ✅ CORRECT - Extract .content
"returnValue": "{{aiOutput.content}}",
"outputDisplay": { "type": "text" }
```

**"Table column key not found in data"**
- Verify column `key` matches object property names
- Check returnValue data structure matches columns

### Execution Errors

**"Timeout"**
- API call slow
- Check API status

**"Rate limit"**
- Add `utilities.delay.sleep`: `{"milliseconds": 1000}`
- Reduce execution frequency

**"Network error"**
- API unreachable
- Verify URL/credentials

---

## Testing

**Dry-run** (structure only):
```bash
npx tsx scripts/test-workflow.ts workflow.json --dry-run
```
Shows step flow, no execution

**Full test** (real execution):
```bash
npx tsx scripts/test-workflow.ts workflow.json
```
Temp import → execute → cleanup + error analysis

**When to test**:
1. After validation passes
2. Before production import
3. When credentials configured
4. To verify output format

**Test output shows**:
- Duration
- Output compatibility
- Error category
- Fix suggestions

---

## Debugging Steps

1. **Read error message** - Note exact text and category (new validator provides detailed suggestions)
2. **Find in catalog above** - Match error to solution
3. **Apply fix** - Edit workflow JSON directly OR use JSON Patch:
   ```bash
   npm run patch workflow/{name}.json fix-patch.json --write
   ```
4. **Re-validate** - Run validation: `npm run validate workflow/{name}.json`
5. **Test** - Dry-run first, then full test

---

## Workflow Management

### Update Existing Workflow

1. Read: `cat workflow/{name}.json`
2. Edit JSON (or use JSON Patch: `npm run patch workflow/{name}.json fix.json --write`)
3. Validate: `npm run validate workflow/{name}.json`
4. Test: `npx tsx scripts/test-workflow.ts workflow/{name}.json`
5. Re-import: `npx tsx scripts/import-workflow.ts workflow/{name}.json`

### Create New Version

- Change `name` field
- Import creates new workflow with new ID
- Old workflow remains

**Don't**:
- Edit database directly
- Change workflow IDs
- Import without testing

---

## Advanced Topics

**Rate limiting**: Add delays between steps with `utilities.delay.sleep`

**Parallelization**: Executor auto-detects parallelizable steps (no config needed)

**Control flow**: Use ConditionStep, ForEachStep, WhileStep (maxIterations: 100 default)

**Database**: Tables auto-create from data (string→TEXT, number→INTEGER, Date→TIMESTAMP)

**OAuth**: Tokens auto-refresh for Twitter, YouTube, GitHub

---

## Quick Fixes

| Error | Quick Fix |
|-------|-----------|
| Module not found | Re-search, check lowercase |
| Options undefined | Add `{"options": {...}}` wrapper |
| AI text fails | Use `.content`: `{{ai.content}}` |
| Variable undefined | Check `outputAs` in previous step |
| zipToObjects | Convert strings to arrays |
| Credential undefined | Check exact name in existing workflows |
| returnValue wrong | Move to config level |
| chat trigger error | Add `"config": {"inputVariable": "userMessage"}` |
| chat-input fields | Ensure id, label, key, type, required present |
| Table type mismatch | Wrap in array: `[{{value}}]` or use forEach |
| Text type mismatch | Extract `.content` from AI output |
| gmail/outlook config | Add filters and pollInterval |
| Timeout | Check API, add delays |

**For building workflows**: Use `/workflow` command
