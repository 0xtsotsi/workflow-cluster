/**
 * Workflow Validator using AJV
 *
 * Provides fast, comprehensive validation with detailed error messages
 * that LLMs can understand and fix.
 */

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import ajvKeywords from 'ajv-keywords';
import { workflowSchema, chatInputTriggerSchema, cronTriggerSchema, chatTriggerSchema } from './workflow-schema';
import { getModuleRegistry } from './module-registry';
import { logger } from '@/lib/logger';

// Initialize AJV with strict mode and all features
const ajv = new Ajv({
  allErrors: true, // Return all errors, not just first
  verbose: true, // Include schema and data in errors
  strict: true, // Strict schema validation
  validateFormats: true,
  $data: true // Enable $data references
});

// Add format validators (date-time, email, uri, etc.)
addFormats(ajv);

// Add keywords (transform, uniqueItemProperties, etc.)
ajvKeywords(ajv);

// Compile schemas
const validateWorkflow = ajv.compile(workflowSchema);
const validateChatInputTrigger = ajv.compile(chatInputTriggerSchema);
const validateCronTrigger = ajv.compile(cronTriggerSchema);
const validateChatTrigger = ajv.compile(chatTriggerSchema);

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params?: Record<string, unknown>;
  suggestion?: string;
}

/**
 * Format AJV errors into human-readable messages
 */
function formatAjvErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors || errors.length === 0) return [];

  return errors.map((error) => {
    const path = error.instancePath || 'root';
    let message = error.message || 'Validation failed';
    let suggestion: string | undefined;

    // Enhance error messages based on keyword
    switch (error.keyword) {
      case 'required':
        message = `Missing required field: ${error.params?.missingProperty}`;
        suggestion = `Add "${error.params?.missingProperty}" to the object`;
        break;
      case 'type':
        message = `Expected type "${error.params?.type}" but got "${typeof error.data}"`;
        suggestion = `Change value to type ${error.params?.type}`;
        break;
      case 'enum':
        message = `Value must be one of: ${error.params?.allowedValues?.join(', ')}`;
        suggestion = `Use one of the allowed values`;
        break;
      case 'pattern':
        message = `Value does not match pattern: ${error.params?.pattern}`;
        if (error.params?.pattern === '^[a-z-]+\\.[a-z-]+\\.[a-zA-Z]+$') {
          suggestion = 'Use format: category.module.function (e.g., "ai.openai.generateText")';
        } else if (error.params?.pattern === '^\\{\\{[^}]+\\}\\}$') {
          suggestion = 'Use format: {{variableName}} (e.g., "{{result}}")';
        }
        break;
      case 'minItems':
        message = `Array must have at least ${error.params?.limit} items`;
        suggestion = 'Add more items to the array';
        break;
      case 'minLength':
        message = `String must be at least ${error.params?.limit} characters`;
        suggestion = 'Use a longer string';
        break;
      case 'maxLength':
        message = `String must be at most ${error.params?.limit} characters`;
        suggestion = 'Use a shorter string';
        break;
      case 'const':
        message = `Value must be exactly: ${error.params?.allowedValue}`;
        suggestion = `Change to "${error.params?.allowedValue}"`;
        break;
    }

    return {
      path,
      message,
      keyword: error.keyword,
      params: error.params,
      suggestion
    };
  });
}

/**
 * Validate workflow structure using JSON Schema
 */
export function validateWorkflowStructure(workflow: unknown): ValidationResult {
  const valid = validateWorkflow(workflow);

  if (!valid) {
    logger.debug({ errors: validateWorkflow.errors }, 'Workflow structure validation failed');
    return {
      valid: false,
      errors: formatAjvErrors(validateWorkflow.errors)
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate trigger configuration
 */
export function validateTrigger(trigger: { type: string; config: Record<string, unknown> }): ValidationResult {
  let triggerValidator: ValidateFunction | null = null;

  switch (trigger.type) {
    case 'chat-input':
      triggerValidator = validateChatInputTrigger;
      break;
    case 'cron':
      triggerValidator = validateCronTrigger;
      break;
    case 'chat':
      triggerValidator = validateChatTrigger;
      break;
    // manual, webhook, telegram, discord don't require specific config
    default:
      return { valid: true, errors: [] };
  }

  const valid = triggerValidator(trigger.config);

  if (!valid) {
    return {
      valid: false,
      errors: formatAjvErrors(triggerValidator.errors)
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate module paths exist in registry
 */
export function validateModulePaths(steps: Array<{ id: string; module: string }>): ValidationResult {
  const errors: ValidationError[] = [];
  const registry = getModuleRegistry();

  // Build map of valid module paths
  const validPaths = new Set<string>();
  registry.forEach((category) => {
    category.modules.forEach((module) => {
      module.functions.forEach((fn) => {
        validPaths.add(`${category.name}.${module.name}.${fn.name}`);
      });
    });
  });

  // Validate each step's module path
  steps.forEach((step) => {
    if (!validPaths.has(step.module)) {
      // Try to find similar modules
      const parts = step.module.split('.');
      const [categoryName, moduleName] = parts;

      const category = registry.find(c => c.name === categoryName);
      let suggestion = 'Check module path format: category.module.function';

      if (!category) {
        const availableCategories = registry.map(c => c.name).join(', ');
        suggestion = `Category "${categoryName}" not found. Available: ${availableCategories}`;
      } else {
        const foundModule = category.modules.find(m => m.name === moduleName);
        if (!foundModule) {
          const availableModules = category.modules.map(m => m.name).join(', ');
          suggestion = `Module "${moduleName}" not found in category "${categoryName}". Available: ${availableModules}`;
        } else {
          const availableFunctions = foundModule.functions.map(f => f.name).join(', ');
          suggestion = `Function not found in ${categoryName}.${moduleName}. Available: ${availableFunctions}`;
        }
      }

      errors.push({
        path: `/config/steps/${step.id}/module`,
        message: `Module path "${step.module}" not found in registry`,
        keyword: 'module-exists',
        suggestion
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate variable references
 */
export function validateVariableReferences(steps: Array<{ id: string; inputs: Record<string, unknown>; outputAs?: string }>): ValidationResult {
  const errors: ValidationError[] = [];
  const declaredVars = new Set<string>(['user', 'trigger']); // Built-in variables

  steps.forEach((step, index) => {
    // Check variable references in inputs
    const inputsStr = JSON.stringify(step.inputs);
    const varRefs = inputsStr.match(/\{\{(\w+)(?:\.\w+)*(?:\[\d+\])*\}\}/g) || [];

    varRefs.forEach((ref) => {
      const varName = ref.match(/\{\{(\w+)/)?.[1];
      if (varName && !declaredVars.has(varName)) {
        errors.push({
          path: `/config/steps/${index}/inputs`,
          message: `Reference to undeclared variable: ${varName}`,
          keyword: 'variable-declared',
          suggestion: `Declare "${varName}" in a previous step using "outputAs", or check for typos`
        });
      }
    });

    // Register this step's output variable
    if (step.outputAs) {
      declaredVars.add(step.outputAs);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate output display configuration matches data type
 */
export function validateOutputDisplay(
  outputDisplay: { type: string; columns?: Array<{ key: string; label: string }> } | undefined,
  lastStep: { id: string; module: string } | undefined
): ValidationResult {
  if (!outputDisplay || !lastStep) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = [];

  // Check table display has columns
  if (outputDisplay.type === 'table' && (!outputDisplay.columns || outputDisplay.columns.length === 0)) {
    errors.push({
      path: '/config/outputDisplay/columns',
      message: 'Table display requires columns array',
      keyword: 'table-columns',
      suggestion: 'Add columns array with at least one column definition'
    });
  }

  // Warn about potential type mismatches
  const singleValueModules = ['average', 'sum', 'count', 'min', 'max', 'hashSHA256', 'generateUUID', 'now', 'toISO'];
  if (outputDisplay.type === 'table' && singleValueModules.some(mod => lastStep.module.includes(mod))) {
    errors.push({
      path: '/config/outputDisplay/type',
      message: `Last step likely returns single value, but output display is "table" (expects array)`,
      keyword: 'output-type-mismatch',
      suggestion: 'Change outputDisplay.type to "text" or "json", or ensure last step returns an array'
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Comprehensive workflow validation
 */
export function validateWorkflowComplete(workflow: unknown): ValidationResult {
  // First validate structure
  const structureResult = validateWorkflowStructure(workflow);
  if (!structureResult.valid) {
    return structureResult;
  }

  const w = workflow as {
    trigger?: { type: string; config: Record<string, unknown> };
    config: {
      steps: Array<{ id: string; module: string; inputs: Record<string, unknown>; outputAs?: string }>;
      outputDisplay?: { type: string; columns?: Array<{ key: string; label: string }> };
    };
  };

  const allErrors: ValidationError[] = [];

  // Validate trigger config
  if (w.trigger) {
    const triggerResult = validateTrigger(w.trigger);
    allErrors.push(...triggerResult.errors);
  }

  // Validate module paths
  const moduleResult = validateModulePaths(w.config.steps);
  allErrors.push(...moduleResult.errors);

  // Validate variable references
  const varResult = validateVariableReferences(w.config.steps);
  allErrors.push(...varResult.errors);

  // Validate output display
  const lastStep = w.config.steps[w.config.steps.length - 1];
  const outputResult = validateOutputDisplay(w.config.outputDisplay, lastStep);
  allErrors.push(...outputResult.errors);

  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';

  let output = 'Validation Errors:\n\n';

  errors.forEach((error, index) => {
    output += `${index + 1}. ${error.path}\n`;
    output += `   ${error.message}\n`;
    if (error.suggestion) {
      output += `   💡 ${error.suggestion}\n`;
    }
    output += '\n';
  });

  return output;
}
