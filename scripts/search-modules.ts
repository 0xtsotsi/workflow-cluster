#!/usr/bin/env tsx
/**
 * Module Search Script
 *
 * Search and browse available workflow modules.
 * Helps discover what modules exist and their function signatures.
 *
 * Usage:
 *   npx tsx scripts/search-modules.ts                    # List all categories
 *   npx tsx scripts/search-modules.ts email              # Search for "email"
 *   npx tsx scripts/search-modules.ts --category social  # List all social modules
 */

import { getModuleRegistry } from '../src/lib/workflows/module-registry';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage:
  npx tsx scripts/search-modules.ts                    # List all categories
  npx tsx scripts/search-modules.ts <query>            # Search for modules
  npx tsx scripts/search-modules.ts --category <name>  # List category modules
  npx tsx scripts/search-modules.ts --list             # List all modules

Examples:
  npx tsx scripts/search-modules.ts email
  npx tsx scripts/search-modules.ts --category communication
  npx tsx scripts/search-modules.ts twitter
  `);
  process.exit(0);
}

const registry = getModuleRegistry();

// --category flag
if (args[0] === '--category') {
  const categoryName = args[1]?.toLowerCase();
  if (!categoryName) {
    console.error('❌ Please specify a category name');
    process.exit(1);
  }

  const category = registry.find(
    (cat) => cat.name.toLowerCase() === categoryName
  );

  if (!category) {
    console.error(`❌ Category not found: ${categoryName}`);
    console.log(`\nAvailable categories: ${registry.map((c) => c.name.toLowerCase()).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n📦 ${category.name} Modules\n`);
  category.modules.forEach((mod) => {
    console.log(`  ${mod.name}:`);
    mod.functions.forEach((fn) => {
      console.log(`    • ${fn.name}() - ${fn.description}`);
      console.log(`      ${fn.signature}`);
      if (fn.example) {
        console.log(`      Example: ${fn.example}`);
      }
      console.log();
    });
  });
  process.exit(0);
}

// --list flag
if (args[0] === '--list') {
  console.log('\n📚 All Available Modules\n');
  registry.forEach((category) => {
    console.log(`${category.name}:`);
    category.modules.forEach((mod) => {
      console.log(`  • ${mod.name} (${mod.functions.length} functions)`);
      mod.functions.forEach((fn) => {
        console.log(`    - ${fn.name}()`);
      });
    });
    console.log();
  });
  process.exit(0);
}

// Search query
if (args.length === 0) {
  console.log('\n📦 Available Module Categories:\n');
  registry.forEach((category) => {
    const moduleCount = category.modules.length;
    const functionCount = category.modules.reduce(
      (sum, mod) => sum + mod.functions.length,
      0
    );
    console.log(`  ${category.name}: ${moduleCount} modules, ${functionCount} functions`);
    category.modules.forEach((mod) => {
      console.log(`    • ${mod.name}`);
    });
    console.log();
  });

  console.log('\nTip: Use --category <name> to see all functions in a category');
  console.log('     Use <query> to search for specific modules');
  process.exit(0);
}

// Search mode
const query = args.join(' ').toLowerCase();
console.log(`\n🔍 Searching for: "${query}"\n`);

let found = false;

registry.forEach((category) => {
  category.modules.forEach((mod) => {
    mod.functions.forEach((fn) => {
      const searchText = `${category.name} ${mod.name} ${fn.name} ${fn.description}`.toLowerCase();

      if (searchText.includes(query)) {
        if (!found) found = true;

        console.log(`${category.name.toLowerCase()}.${mod.name}.${fn.name}`);
        console.log(`  ${fn.description}`);
        console.log(`  ${fn.signature}`);
        if (fn.example) {
          console.log(`  Example: ${fn.example}`);
        }
        console.log();
      }
    });
  });
});

if (!found) {
  console.log('❌ No modules found matching your query');
  console.log('\nTip: Try a broader search term or use --list to see all modules');
}
