/**
 * Generate Module Registry Entries
 *
 * Scans all module files and generates registry entries for the module-registry.ts file
 */

import * as fs from 'fs';
import * as path from 'path';

interface FunctionInfo {
  name: string;
  description: string;
  signature: string;
  params: string[];
}

interface ModuleInfo {
  name: string;
  functions: FunctionInfo[];
}

interface CategoryInfo {
  name: string;
  path: string;
  modules: ModuleInfo[];
}

// Define all categories and their modules based on Phase 3 implementation
const categoryDefinitions: CategoryInfo[] = [
  {
    name: 'Video Automation',
    path: 'video',
    modules: [
      { name: 'runway', functions: [] },
      { name: 'heygen', functions: [] },
      { name: 'synthesia', functions: [] },
      { name: 'whisper', functions: [] },
      { name: 'elevenlabs', functions: [] },
      { name: 'cloudinary', functions: [] },
      { name: 'vimeo', functions: [] },
      { name: 'tiktok', functions: [] },
    ]
  },
  {
    name: 'Business',
    path: 'business',
    modules: [
      { name: 'hubspot', functions: [] },
      { name: 'salesforce', functions: [] },
      { name: 'pipedrive', functions: [] },
      { name: 'quickbooks', functions: [] },
      { name: 'freshbooks', functions: [] },
      { name: 'xero', functions: [] },
      { name: 'docusign', functions: [] },
      { name: 'hellosign', functions: [] },
    ]
  },
  {
    name: 'Lead Generation',
    path: 'leads',
    modules: [
      { name: 'hunter', functions: [] },
      { name: 'apollo', functions: [] },
      { name: 'clearbit', functions: [] },
      { name: 'zoominfo', functions: [] },
      { name: 'lusha', functions: [] },
      { name: 'proxycurl', functions: [] },
      { name: 'phantombuster', functions: [] },
      { name: 'apify', functions: [] },
    ]
  },
  {
    name: 'E-Commerce',
    path: 'ecommerce',
    modules: [
      { name: 'shopify', functions: [] },
      { name: 'woocommerce', functions: [] },
      { name: 'amazon-sp', functions: [] },
      { name: 'etsy', functions: [] },
      { name: 'ebay', functions: [] },
      { name: 'square', functions: [] },
      { name: 'printful', functions: [] },
    ]
  },
  {
    name: 'Content',
    path: 'content',
    modules: [
      { name: 'medium', functions: [] },
      { name: 'ghost', functions: [] },
      { name: 'wordpress', functions: [] },
      { name: 'unsplash', functions: [] },
      { name: 'pexels', functions: [] },
      { name: 'canva', functions: [] },
      { name: 'bannerbear', functions: [] },
      { name: 'placid', functions: [] },
    ]
  },
  {
    name: 'Developer Tools',
    path: 'devtools',
    modules: [
      { name: 'github-actions', functions: [] },
      { name: 'circleci', functions: [] },
      { name: 'jenkins', functions: [] },
      { name: 'vercel', functions: [] },
      { name: 'netlify', functions: [] },
      { name: 'heroku', functions: [] },
      { name: 'datadog', functions: [] },
      { name: 'sentry', functions: [] },
    ]
  },
];

// Additional modules to add to existing categories
const existingCategoryUpdates = {
  'Communication': ['intercom'],
  'Data Processing': ['snowflake', 'bigquery', 'redshift', 'kafka', 'rabbitmq', 'huggingface', 'replicate-data'],
  'AI': ['replicate-video', 'cohere'],
  'Utilities': ['parallel', 'approval', 'scheduling', 'error-recovery', 'state-management', 'webhooks-advanced', 'javascript'],
};

/**
 * Extract function information from a TypeScript module file
 */
function extractFunctionsFromFile(filePath: string): FunctionInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const functions: FunctionInfo[] = [];

  // Match both patterns:
  // 1. export async function name(...): Promise<...> {
  // 2. export const name = withRateLimit(...) or export const name = createCircuitBreaker(...)

  // Pattern 1: export async function
  const asyncFunctionRegex = /export\s+async\s+function\s+(\w+)\s*\(([\s\S]*?)\)\s*:\s*Promise<([\s\S]*?)>\s*\{/g;

  // Pattern 2: export const = withRateLimit or createCircuitBreaker
  const constExportRegex = /export\s+const\s+(\w+)\s*=/g;

  // First, find all export const declarations
  let match;
  while ((match = constExportRegex.exec(content)) !== null) {
    const functionName = match[1];

    // Extract description from JSDoc above this export
    const beforeFunction = content.substring(0, match.index);
    const lines = beforeFunction.split('\n');
    let description = '';

    // Look backwards for JSDoc comment
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('/**')) {
        // Found start of JSDoc, extract description
        const jsdocStart = i;
        const jsdocEnd = lines.length - 1;
        const jsdocLines = lines.slice(jsdocStart, jsdocEnd + 1);

        // Extract description (first non-empty line after /**)
        for (const jsdocLine of jsdocLines) {
          const cleaned = jsdocLine.replace(/^\/?\*+\s*/, '').trim();
          if (cleaned && !cleaned.startsWith('@') && !cleaned.endsWith('*/')) {
            description = cleaned;
            break;
          }
        }
        break;
      } else if (line.startsWith('*') || line === '') {
        continue;
      } else {
        // Not a JSDoc comment
        break;
      }
    }

    // Try to find the actual function signature by looking for the wrapped function
    // Look for patterns like: withRateLimit(heygenRateLimiter, createCircuitBreaker(async (options: {...}) => {...}
    const afterExport = content.substring(match.index);
    const signatureMatch = afterExport.match(/\((?:async\s+)?\(([^)]*)\)/);

    let paramNames: string[] = [];
    if (signatureMatch && signatureMatch[1]) {
      const params = signatureMatch[1];
      const paramMatches = params.matchAll(/(\w+)(?:\s*:\s*[^,}]+)?/g);
      for (const paramMatch of paramMatches) {
        if (paramMatch[1] && paramMatch[1] !== 'async') {
          paramNames.push(paramMatch[1]);
        }
      }
    }

    // Generate signature
    const signature = paramNames.length > 0
      ? `${functionName}({ ${paramNames.join(', ')} })`
      : `${functionName}()`;

    functions.push({
      name: functionName,
      description: description || `${functionName} function`,
      signature,
      params: paramNames,
    });
  }

  // Also handle export async function pattern
  while ((match = asyncFunctionRegex.exec(content)) !== null) {
    const functionName = match[1];
    const params = match[2];

    // Extract JSDoc comment above the function
    const beforeFunction = content.substring(0, match.index);
    const lines = beforeFunction.split('\n');
    let description = '';

    // Look backwards for JSDoc comment
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('/**')) {
        // Found start of JSDoc, extract description
        const jsdocStart = i;
        const jsdocEnd = lines.length - 1;
        const jsdocLines = lines.slice(jsdocStart, jsdocEnd + 1);

        // Extract description (first non-empty line after /**)
        for (const jsdocLine of jsdocLines) {
          const cleaned = jsdocLine.replace(/^\/?\*+\s*/, '').trim();
          if (cleaned && !cleaned.startsWith('@')) {
            description = cleaned;
            break;
          }
        }
        break;
      } else if (line.startsWith('*') || line === '') {
        continue;
      } else {
        // Not a JSDoc comment
        break;
      }
    }

    // Extract parameter names
    const paramNames: string[] = [];
    const paramMatches = params.matchAll(/(\w+)\s*:/g);
    for (const paramMatch of paramMatches) {
      paramNames.push(paramMatch[1]);
    }

    // Generate signature from params
    const paramsObj = params.trim().startsWith('options:') || params.trim().startsWith('{');
    const signature = paramsObj
      ? `${functionName}({ ${paramNames.join(', ')} })`
      : `${functionName}(${paramNames.join(', ')})`;

    functions.push({
      name: functionName,
      description: description || `${functionName} function`,
      signature,
      params: paramNames,
    });
  }

  return functions;
}

/**
 * Generate registry entries for all categories
 */
function generateRegistryEntries(): void {
  const modulesDir = path.join(__dirname, '../src/modules');

  console.log('='.repeat(80));
  console.log('GENERATING MODULE REGISTRY ENTRIES');
  console.log('='.repeat(80));
  console.log();

  let totalFunctions = 0;
  let totalModules = 0;

  for (const category of categoryDefinitions) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CATEGORY: ${category.name} (path: ${category.path})`);
    console.log('='.repeat(80));
    console.log();
    console.log(`    {`);
    console.log(`      name: '${category.name}',`);
    console.log(`      modules: [`);

    for (const module of category.modules) {
      const modulePath = path.join(modulesDir, category.path, `${module.name}.ts`);

      if (!fs.existsSync(modulePath)) {
        console.error(`WARNING: Module file not found: ${modulePath}`);
        continue;
      }

      const functions = extractFunctionsFromFile(modulePath);
      totalFunctions += functions.length;
      totalModules++;

      console.log(`        {`);
      console.log(`          name: '${module.name}',`);
      console.log(`          functions: [`);

      for (const func of functions) {
        console.log(`            {`);
        console.log(`              name: '${func.name}',`);
        console.log(`              description: '${func.description.replace(/'/g, "\\'")}',`);
        console.log(`              signature: '${func.signature}',`);
        console.log(`            },`);
      }

      console.log(`          ],`);
      console.log(`        },`);
    }

    console.log(`      ],`);
    console.log(`    },`);
  }

  // Generate entries for updates to existing categories
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('UPDATES TO EXISTING CATEGORIES');
  console.log('='.repeat(80));
  console.log();

  for (const [categoryName, moduleNames] of Object.entries(existingCategoryUpdates)) {
    console.log(`\n--- ${categoryName} ---\n`);

    for (const moduleName of moduleNames) {
      // Determine the path based on category
      let categoryPath = '';
      if (categoryName === 'Communication') categoryPath = 'communication';
      else if (categoryName === 'Data Processing') categoryPath = 'dataprocessing';
      else if (categoryName === 'AI') categoryPath = 'ai';
      else if (categoryName === 'Utilities') categoryPath = 'utilities';

      const modulePath = path.join(modulesDir, categoryPath, `${moduleName}.ts`);

      if (!fs.existsSync(modulePath)) {
        console.error(`WARNING: Module file not found: ${modulePath}`);
        continue;
      }

      const functions = extractFunctionsFromFile(modulePath);
      totalFunctions += functions.length;
      totalModules++;

      console.log(`        {`);
      console.log(`          name: '${moduleName}',`);
      console.log(`          functions: [`);

      for (const func of functions) {
        console.log(`            {`);
        console.log(`              name: '${func.name}',`);
        console.log(`              description: '${func.description.replace(/'/g, "\\'")}',`);
        console.log(`              signature: '${func.signature}',`);
        console.log(`            },`);
      }

      console.log(`          ],`);
      console.log(`        },`);
    }
  }

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total modules processed: ${totalModules}`);
  console.log(`Total functions extracted: ${totalFunctions}`);
  console.log('='.repeat(80));
}

// Run the generator
generateRegistryEntries();
