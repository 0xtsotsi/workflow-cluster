#!/usr/bin/env tsx
/**
 * Validate Workflow Script (New AJV-based version)
 *
 * Validates a workflow JSON/YAML file using comprehensive JSON Schema validation.
 * Provides detailed, actionable error messages.
 *
 * Usage:
 *   npx tsx scripts/validate-workflow-new.ts <workflow-file.json>
 *   npx tsx scripts/validate-workflow-new.ts <workflow-file.yaml>
 *   npx tsx scripts/validate-workflow-new.ts --stdin < workflow.json
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import YAML from 'yaml';
import { validateWorkflowComplete, formatValidationErrors } from '../src/lib/workflows/workflow-validator';
import type { WorkflowExport } from '../src/lib/workflows/import-export';

/**
 * Deep validation - actually load modules and verify functions exist
 */
async function validateModuleFunctions(workflow: WorkflowExport): Promise<string[]> {
  const errors: string[] = [];

  for (const step of workflow.config.steps) {
    const [category, moduleName, functionName] = step.module.split('.');

    try {
      // Construct module path
      const modulePath = `../src/modules/${category}/${moduleName}`;

      // Dynamically import the module
      const mod = await import(modulePath);

      // Check if function exists
      if (typeof mod[functionName] !== 'function') {
        errors.push(
          `Step "${step.id}": Function "${functionName}" not found in module ${category}/${moduleName}`
        );

        // Show available functions
        const availableFunctions = Object.keys(mod).filter(
          key => typeof mod[key] === 'function'
        );
        if (availableFunctions.length > 0) {
          errors.push(
            `   Available functions: ${availableFunctions.join(', ')}`
          );
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Module doesn't exist
      errors.push(
        `Step "${step.id}": Failed to load module ${category}/${moduleName}: ${error?.message || error}`
      );
    }
  }

  return errors;
}

async function validateWorkflow(workflowContent: string, isYaml: boolean): Promise<void> {
  try {
    console.log('🔍 Validating workflow...\n');

    // Parse JSON or YAML
    let workflow: WorkflowExport;
    try {
      if (isYaml) {
        workflow = YAML.parse(workflowContent) as WorkflowExport;
        console.log('✅ YAML parsed successfully');
      } else {
        // Check for invalid JSON values like undefined
        if (workflowContent.includes('undefined')) {
          console.error('❌ Invalid JSON: Contains "undefined" which is not valid JSON');
          console.error('💡 Tip: Replace undefined with null, or remove the field entirely');
          process.exit(1);
        }
        workflow = JSON.parse(workflowContent);
        console.log('✅ JSON parsed successfully');
      }
    } catch (error) {
      console.error('❌ Invalid format');
      console.error(error);
      process.exit(1);
    }

    // Comprehensive validation using AJV
    console.log('\n🔍 Running comprehensive validation...\n');
    const result = validateWorkflowComplete(workflow);

    if (!result.valid) {
      console.error('❌ Workflow validation failed:\n');
      console.error(formatValidationErrors(result.errors));
      process.exit(1);
    }

    console.log('✅ All validation checks passed');

    // Deep validation - load actual modules and verify functions
    console.log('\n🔍 Deep validation - checking if functions actually exist in modules...');
    const functionErrors = await validateModuleFunctions(workflow);
    if (functionErrors.length > 0) {
      console.error('\n❌ Function validation failed:\n');
      functionErrors.forEach((error) => {
        console.error(`   • ${error}`);
      });
      console.log('\n💡 Tip: The function name in the registry might not match the actual implementation');
      console.log('   Run: npx tsx scripts/generate-module-registry.ts to sync the registry');
      process.exit(1);
    }
    console.log('✅ All functions verified in actual module files');

    // Check for missing returnValue (warning, not error)
    const config = workflow.config as { returnValue?: string };
    if (!config.returnValue && workflow.trigger?.type !== 'chat') {
      console.log('\n⚠️  Missing returnValue - workflow will use auto-detection\n');
      console.log('   Auto-detection filters out internal variables (user, trigger, credentials)');
      console.log('   but it\'s better to explicitly specify what to return.\n');
      console.log('   💡 Recommended: Add returnValue to config:');

      // Suggest based on last step
      const lastStep = workflow.config.steps[workflow.config.steps.length - 1];
      if (lastStep.outputAs) {
        console.log(`   📝   "returnValue": "{{${lastStep.outputAs}}}"`);
      } else {
        console.log('   📝   "returnValue": "{{yourVariableName}}"');
      }
    }

    // Summary
    console.log('\n📊 Workflow Summary:');
    console.log(`   Name: ${workflow.name}`);
    console.log(`   Description: ${workflow.description}`);
    console.log(`   Steps: ${workflow.config.steps.length}`);
    console.log(`   Version: ${workflow.version}`);

    if (workflow.trigger) {
      console.log(`   Trigger: ${workflow.trigger.type}`);
    }

    if (workflow.metadata?.category) {
      console.log(`   Category: ${workflow.metadata.category}`);
    }

    if (workflow.metadata?.tags?.length) {
      console.log(`   Tags: ${workflow.metadata.tags.join(', ')}`);
    }

    if (workflow.metadata?.requiresCredentials?.length) {
      console.log(`   Required credentials: ${workflow.metadata.requiresCredentials.join(', ')}`);
    }

    console.log('\n✅ Workflow validation complete!');
    console.log('\n💡 Import with: npx tsx scripts/import-workflow.ts <file>');
  } catch (error) {
    console.error('❌ Validation error:', error);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage:
  npx tsx scripts/validate-workflow-new.ts <workflow-file.json>
  npx tsx scripts/validate-workflow-new.ts <workflow-file.yaml>
  npx tsx scripts/validate-workflow-new.ts --stdin < workflow.json

Options:
  --stdin    Read workflow from stdin
  --help     Show this help message

Features:
  • Comprehensive JSON Schema validation with AJV
  • YAML support in addition to JSON
  • Detailed, actionable error messages
  • Module path and function existence verification
  • Variable reference validation
  • Output display compatibility checks
  `);
  process.exit(0);
}

let workflowContent: string;
let isYaml = false;

if (args[0] === '--stdin') {
  // Read from stdin
  const chunks: Buffer[] = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('end', () => {
    workflowContent = Buffer.concat(chunks).toString('utf-8');
    // Try to detect YAML vs JSON
    isYaml = !workflowContent.trim().startsWith('{');
    validateWorkflow(workflowContent, isYaml);
  });
} else {
  // Read from file
  const filePath = resolve(process.cwd(), args[0]);
  isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml');

  try {
    workflowContent = readFileSync(filePath, 'utf-8');
    validateWorkflow(workflowContent, isYaml);
  } catch (error) {
    console.error(`❌ Failed to read file: ${filePath}`);
    console.error(error);
    process.exit(1);
  }
}
