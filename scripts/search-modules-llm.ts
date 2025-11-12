#!/usr/bin/env tsx
/**
 * LLM-Optimized Module Search
 *
 * Designed for LLMs to quickly find modules without context bloat.
 * Returns ONLY relevant information in a concise, structured format.
 *
 * Usage:
 *   npx tsx scripts/search-modules-llm.ts email
 *   npx tsx scripts/search-modules-llm.ts --category communication
 *   npx tsx scripts/search-modules-llm.ts --function sendEmail
 *   npx tsx scripts/search-modules-llm.ts --format json  # Machine-readable
 */

import { getModuleRegistry } from '../src/lib/workflows/module-registry';

const args = process.argv.slice(2);

// Parse flags
const formatFlag = args.find((arg) => arg === '--format')
  ? args[args.indexOf('--format') + 1]
  : 'text';
const categoryFlag = args.find((arg) => arg === '--category')
  ? args[args.indexOf('--category') + 1]
  : null;
const functionFlag = args.find((arg) => arg === '--function')
  ? args[args.indexOf('--function') + 1]
  : null;
const limitFlag = args.find((arg) => arg === '--limit')
  ? parseInt(args[args.indexOf('--limit') + 1])
  : 10;

// Get search query (everything that's not a flag)
const query = args
  .filter((arg, i) => {
    const prev = args[i - 1];
    return !arg.startsWith('--') && prev !== '--format' && prev !== '--category' && prev !== '--function' && prev !== '--limit';
  })
  .join(' ')
  .toLowerCase();

interface ModuleInfo {
  path: string;
  description: string;
  signature: string;
  params: {
    name: string;
    required: boolean;
  }[];
}

/**
 * Parse function signature to extract parameters
 */
function parseSignature(signature: string): { name: string; required: boolean }[] {
  const params: { name: string; required: boolean }[] = [];

  const match = signature.match(/\(([^)]*)\)/);
  if (!match || !match[1]) return params;

  const paramStr = match[1].trim();
  if (!paramStr) return params;

  // Handle object destructuring: { param1, param2, param3? }
  if (paramStr.startsWith('{')) {
    const paramMatch = paramStr.match(/\{\s*([^}]+)\s*\}/);
    if (paramMatch) {
      const paramList = paramMatch[1].split(',').map(p => p.trim());
      paramList.forEach(param => {
        const required = !param.endsWith('?');
        const name = param.replace('?', '').trim();
        params.push({ name, required });
      });
    }
  } else {
    // Handle regular parameters
    const paramList = paramStr.split(',').map(p => p.trim());
    paramList.forEach(param => {
      const required = !param.includes('?');
      const name = param.split(/[?:]/)[0].trim();
      if (name) params.push({ name, required });
    });
  }

  return params;
}

/**
 * Search modules and return results
 */
function searchModules(): ModuleInfo[] {
  const registry = getModuleRegistry();
  const results: ModuleInfo[] = [];

  registry.forEach((category) => {
    // Filter by category if specified
    if (categoryFlag && category.name.toLowerCase() !== categoryFlag.toLowerCase()) {
      return;
    }

    category.modules.forEach((mod) => {
      mod.functions.forEach((fn) => {
        // Filter by function name if specified
        if (functionFlag && fn.name.toLowerCase() !== functionFlag.toLowerCase()) {
          return;
        }

        const searchText = `${category.name} ${mod.name} ${fn.name} ${fn.description}`.toLowerCase();
        const modulePath = `${category.name}.${mod.name}.${fn.name}`;

        // If query provided, filter by it
        if (query && !searchText.includes(query)) {
          return;
        }

        results.push({
          path: modulePath,
          description: fn.description,
          signature: fn.signature,
          params: parseSignature(fn.signature)
        });
      });
    });
  });

  return results.slice(0, limitFlag);
}

/**
 * Format results for LLM consumption
 */
function formatResults(results: ModuleInfo[]): void {
  if (results.length === 0) {
    console.log('No modules found');
    return;
  }

  if (formatFlag === 'json') {
    // Machine-readable JSON
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Compact text format for LLM context
  console.log(`Found ${results.length} module(s):\n`);

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.path}`);
    console.log(`   ${result.description}`);

    // Show parameters inline
    const requiredParams = result.params.filter(p => p.required).map(p => p.name);
    const optionalParams = result.params.filter(p => !p.required).map(p => p.name);

    if (requiredParams.length > 0) {
      console.log(`   Required: ${requiredParams.join(', ')}`);
    }
    if (optionalParams.length > 0) {
      console.log(`   Optional: ${optionalParams.join(', ')}`);
    }
    console.log('');
  });

  console.log(`💡 Use --format json for machine-readable output`);
  console.log(`💡 Use --limit N to show more/fewer results (current: ${limitFlag})`);
}

/**
 * Show usage examples optimized for LLM understanding
 */
function showHelp(): void {
  console.log(`
LLM-Optimized Module Search
===========================

USAGE:
  search-modules-llm.ts <query>                    # Search by keyword
  search-modules-llm.ts --category <name>          # List category
  search-modules-llm.ts --function <name>          # Find exact function
  search-modules-llm.ts <query> --format json      # JSON output

FLAGS:
  --format json          Machine-readable output
  --limit N             Max results (default: 10)
  --category <name>     Filter by category
  --function <name>     Find exact function name

EXAMPLES FOR LLM:
  # Find email modules
  search-modules-llm.ts email

  # Get communication category (concise list)
  search-modules-llm.ts --category communication --limit 20

  # Find specific function
  search-modules-llm.ts --function sendEmail --format json

  # Search with context limit
  search-modules-llm.ts datetime --limit 5

OUTPUT FORMAT (text):
  1. category.module.function
     Description of what it does
     Required: param1, param2
     Optional: param3

OUTPUT FORMAT (json):
  [
    {
      "path": "category.module.function",
      "description": "...",
      "signature": "function(...)",
      "params": [
        {"name": "param1", "required": true},
        {"name": "param2", "required": false}
      ]
    }
  ]

TIPS FOR LLM WORKFLOW GENERATION:
  1. Search before building: "search email" → get exact module paths
  2. Use --limit to avoid context bloat (default is 10)
  3. Use --format json for structured parsing
  4. Copy module path directly to workflow JSON
  5. Check required vs optional params before generating inputs
`);
}

// Main execution
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  showHelp();
  process.exit(0);
}

const results = searchModules();
formatResults(results);
