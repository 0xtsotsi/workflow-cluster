# Scripts

Utility scripts for the b0t project.

## Workflow Management

### Search Modules

Find available modules for workflow creation:

```bash
# List all categories and modules
npx tsx scripts/search-modules.ts

# Search for specific functionality
npx tsx scripts/search-modules.ts "email"
npx tsx scripts/search-modules.ts "twitter"

# List all modules in a category
npx tsx scripts/search-modules.ts --category communication
npx tsx scripts/search-modules.ts --category social

# List all modules with details
npx tsx scripts/search-modules.ts --list
```

### Validate Workflow

Validate a workflow JSON file before importing:

```bash
# Validate from file
npx tsx scripts/validate-workflow.ts workflow.json

# Validate from stdin
cat workflow.json | npx tsx scripts/validate-workflow.ts --stdin
```

Checks:
- JSON structure is valid
- All module paths exist in registry
- Variable references are correct
- Required fields are present

### Import Workflow

Import a workflow JSON file into the database:

```bash
# Import from file
npx tsx scripts/import-workflow.ts workflow.json

# Import from stdin
cat workflow.json | npx tsx scripts/import-workflow.ts --stdin
```

The workflow will be:
- Validated via the API
- Created in the database with a unique ID
- Immediately available in the UI at `/dashboard/workflows`

### Test Workflow

Test a workflow and get detailed error analysis:

```bash
# Dry run (structure check only, no execution)
npx tsx scripts/test-workflow.ts workflow.json --dry-run

# Execute workflow from file (temporary import + run + cleanup)
npx tsx scripts/test-workflow.ts workflow.json

# Execute existing workflow by ID
npx tsx scripts/test-workflow.ts abc-123-def-456
```

**Smart Error Analysis:**
The test script automatically categorizes errors and tells you who can fix them:
- ✅ **Claude can fix**: Module paths, variable references, type mismatches, invalid inputs
- ⚠️  **User action required**: Missing API keys, network issues, permission errors
- 🤝 **Both**: Rate limits, complex logic errors

Output includes:
- Execution duration
- Full output or detailed error
- Error category and suggestions
- Direct links to fix issues

### Complete Workflow Creation Example

```bash
# 1. Search for modules you need
npx tsx scripts/search-modules.ts "datetime"

# 2. Create workflow JSON file (workflow.json)

# 3. Validate the structure
npx tsx scripts/validate-workflow.ts workflow.json

# 4. Test it (dry run first)
npx tsx scripts/test-workflow.ts workflow.json --dry-run

# 5. Test it (real execution)
npx tsx scripts/test-workflow.ts workflow.json

# 6. If successful, import permanently
npx tsx scripts/import-workflow.ts workflow.json

# 7. Open http://localhost:3000/dashboard/workflows and run it!
```

## Export Railway Environment Variables

**Scripts:**
- `export-railway-env.sh` - Generate Railway variable commands
- **Commands:**
  - `npm run railway:env` - Preview commands (recommended first)
  - `npm run railway:sync` - Automatically sync all variables to Railway

This script reads your local `.env.local` (or `.env`) file and syncs environment variables to Railway.

### Quick Start (Recommended)

1. **Make sure you have Railway CLI installed and linked:**
   ```bash
   npm install -g @railway/cli
   railway link  # Link to your Railway service
   ```

2. **Ensure you have `.env.local` with your actual credentials**

3. **Preview what will be synced:**
   ```bash
   npm run railway:env
   ```

4. **Sync all variables automatically:**
   ```bash
   npm run railway:sync
   ```

That's it! All your environment variables are now synced to Railway.

### Manual Usage (Alternative)

If you prefer to review each command individually:

1. **Generate commands:**
   ```bash
   npm run railway:env
   ```

2. **Review the output** - it will show railway commands like:
   ```bash
   railway variables --set "OPENAI_API_KEY=sk-..."
   railway variables --set "TWITTER_API_KEY=..."
   railway variables --set "AUTH_SECRET=..."
   ```

3. **Copy and paste individual commands** you want to run

### 🎯 Smart Local-to-Production Conversion

The sync script **automatically converts** local development values to production values:

**Localhost URL Conversion:**
```bash
# In .env.local (local development)
AUTH_URL=http://localhost:3000
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback

# Automatically becomes in Railway (production)
AUTH_URL=https://b0t-production.up.railway.app
YOUTUBE_REDIRECT_URI=https://b0t-production.up.railway.app/api/youtube/callback
```

**Environment Conversion:**
- `NODE_ENV=development` → `NODE_ENV=production`

**Benefits:**
- ✅ Keep `localhost:3000` in `.env.local` for local development
- ✅ Run `npm run railway:sync` to push to production
- ✅ URLs automatically converted - no manual editing!
- ✅ Same config file works for both local and production

### What Gets Skipped

The script automatically skips:
- Empty values
- Placeholder values (containing `your_` or `_here`)
- `DATABASE_URL` (auto-generated by Railway when you add PostgreSQL)
- `REDIS_URL` (auto-generated by Railway when you add Redis)
- Comments and empty lines

### Important Variables to Set

Make sure these are set in Railway for production:

**Required:**
- `AUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `AUTH_URL` - Your Railway app URL (e.g., `https://b0t-production.up.railway.app`)
- `ADMIN_EMAIL` - Your admin login email
- `ADMIN_PASSWORD` - Your admin password
- `NODE_ENV` - Should be `production`

**API Keys (as needed):**
- `OPENAI_API_KEY` - For AI tweet generation
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, etc. - For Twitter automation
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` - For YouTube automation
- `RAPIDAPI_KEY` - For trending topics

**Auto-Generated by Railway (don't set manually):**
- `DATABASE_URL` - Added when you create PostgreSQL service
- `REDIS_URL` - Added when you create Redis service

### Example Workflows

**Full Setup (First Time):**
```bash
# 1. Copy example env file
cp .env.example .env.local

# 2. Fill in your actual values in .env.local
nano .env.local

# 3. Install and link Railway CLI
npm install -g @railway/cli
railway link

# 4. Sync all variables to Railway
npm run railway:sync
```

**Update Variables (After Changes):**
```bash
# 1. Update your .env.local file
nano .env.local

# 2. Sync changes to Railway
npm run railway:sync
```

### Notes

- The script requires the Railway CLI to be installed: `npm install -g @railway/cli`
- Make sure you're in the correct Railway project before running the commands
- Variables are set for the currently active environment (check with `railway status`)
