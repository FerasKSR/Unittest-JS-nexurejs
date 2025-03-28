/**
 * Validation system for input validation and sanitization
 */

import { URL } from 'node:url';

/**
 * Validation rule
 */
export interface ValidationRule {
  /**
   * Rule type
   */
  type: string;

  /**
   * Rule message
   */
  message?: string;

  /**
   * Rule parameters
   */
  params?: Record<string, any>;
}

/**
 * Validation error
 */
export interface ValidationError {
  /**
   * Field path
   */
  path: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Rule that failed
   */
  rule: string;

  /**
   * Rule parameters
   */
  params?: Record<string, any>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;

  /**
   * Validation errors
   */
  errors: ValidationError[];

  /**
   * Sanitized data
   */
  data: any;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /**
   * Whether to strip unknown properties
   * @default false
   */
  stripUnknown?: boolean;

  /**
   * Whether to allow unknown properties
   * @default true
   */
  allowUnknown?: boolean;

  /**
   * Path prefix for error messages
   */
  pathPrefix?: string;
}

/**
 * Validation schema
 */
export interface ValidationSchema {
  /**
   * Field rules
   */
  [field: string]: ValidationRule[];
}

/**
 * Validator function
 */
export type ValidatorFunction = (
  value: any,
  params?: Record<string, any>,
  data?: any
) => boolean | Promise<boolean>;

/**
 * Sanitizer function
 */
export type SanitizerFunction = (value: any, params?: Record<string, any>) => any;

/**
 * Custom validator function
 */
export type ValidatorFn = (_value: any, _params?: Record<string, any>, _data?: any) => boolean;

/**
 * Validator class
 */
export class Validator {
  private validators = new Map<string, ValidatorFunction>();
  private sanitizers = new Map<string, SanitizerFunction>();
  private messages = new Map<string, string>();

  /**
   * Create a new validator
   */
  constructor() {
    // Register built-in validators
    this.registerValidator('required', value => {
      return value !== undefined && value !== null && value !== '';
    });

    this.registerValidator('string', value => {
      return typeof value === 'string';
    });

    this.registerValidator('number', value => {
      return typeof value === 'number' && !isNaN(value);
    });

    this.registerValidator('boolean', value => {
      return typeof value === 'boolean';
    });

    this.registerValidator('array', value => {
      return Array.isArray(value);
    });

    this.registerValidator('object', value => {
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    });

    this.registerValidator('email', value => {
      if (typeof value !== 'string') return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    });

    this.registerValidator('url', value => {
      if (typeof value !== 'string') return false;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    });

    this.registerValidator('min', (value, params) => {
      if (typeof value === 'number') {
        return value >= params!.min;
      }
      if (typeof value === 'string' || Array.isArray(value)) {
        return value.length >= params!.min;
      }
      return false;
    });

    this.registerValidator('max', (value, params) => {
      if (typeof value === 'number') {
        return value <= params!.max;
      }
      if (typeof value === 'string' || Array.isArray(value)) {
        return value.length <= params!.max;
      }
      return false;
    });

    this.registerValidator('pattern', (value, params) => {
      if (typeof value !== 'string') return false;
      const pattern = new RegExp(params!.pattern);
      return pattern.test(value);
    });

    this.registerValidator('enum', (value, params) => {
      return params!.values.includes(value);
    });

    // Register built-in sanitizers
    this.registerSanitizer('trim', value => {
      if (typeof value !== 'string') return value;
      return value.trim();
    });

    this.registerSanitizer('lowercase', value => {
      if (typeof value !== 'string') return value;
      return value.toLowerCase();
    });

    this.registerSanitizer('uppercase', value => {
      if (typeof value !== 'string') return value;
      return value.toUpperCase();
    });

    this.registerSanitizer('toNumber', value => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const num = Number(value);
        return isNaN(num) ? value : num;
      }
      return value;
    });

    this.registerSanitizer('toBoolean', value => {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    });

    this.registerSanitizer('toString', value => {
      if (value === null || value === undefined) return '';
      return String(value);
    });

    // Register default messages
    this.registerMessage('required', 'This field is required');
    this.registerMessage('string', 'This field must be a string');
    this.registerMessage('number', 'This field must be a number');
    this.registerMessage('boolean', 'This field must be a boolean');
    this.registerMessage('array', 'This field must be an array');
    this.registerMessage('object', 'This field must be an object');
    this.registerMessage('email', 'This field must be a valid email address');
    this.registerMessage('url', 'This field must be a valid URL');
    this.registerMessage('min', 'This field must be at least {min}');
    this.registerMessage('max', 'This field must be at most {max}');
    this.registerMessage('pattern', 'This field must match the pattern {pattern}');
    this.registerMessage('enum', 'This field must be one of: {values}');
  }

  /**
   * Register a validator
   * @param type The validator type
   * @param fn The validator function
   */
  registerValidator(type: string, fn: ValidatorFunction): void {
    this.validators.set(type, fn);
  }

  /**
   * Register a sanitizer
   * @param type The sanitizer type
   * @param fn The sanitizer function
   */
  registerSanitizer(type: string, fn: SanitizerFunction): void {
    this.sanitizers.set(type, fn);
  }

  /**
   * Register a message
   * @param type The rule type
   * @param message The message template
   */
  registerMessage(type: string, message: string): void {
    this.messages.set(type, message);
  }

  /**
   * Format a message with parameters
   * @param message The message template
   * @param params The parameters
   */
  private formatMessage(message: string, params?: Record<string, any>): string {
    if (!params) return message;

    return message.replace(/{([^}]+)}/g, (_, key) => {
      return params[key] !== undefined ? String(params[key]) : `{${key}}`;
    });
  }

  /**
   * Validate data against schema
   * @param data Data to validate
   * @param schema Validation schema
   * @param options Validation options
   */
  async validate(
    data: any,
    schema: ValidationSchema,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      data: { ...data }
    };

    const stripUnknown = options.stripUnknown || false;
    const allowUnknown = options.allowUnknown !== false;
    const pathPrefix = options.pathPrefix || '';

    // Check for unknown fields
    if (!allowUnknown) {
      this.validateUnknownFields(data, schema, result, pathPrefix);
    }

    // Remove unknown fields if stripUnknown is true
    if (stripUnknown) {
      this.stripUnknownFields(result.data, schema);
    }

    // Validate each field
    await this.validateFields(data, schema, result, pathPrefix);

    return result;
  }

  private validateUnknownFields(
    data: any,
    schema: ValidationSchema,
    result: ValidationResult,
    pathPrefix: string
  ): void {
    for (const field in data) {
      if (!(field in schema)) {
        result.valid = false;
        result.errors.push({
          path: pathPrefix ? `${pathPrefix}.${field}` : field,
          message: `Unknown field: ${field}`,
          rule: 'unknown'
        });
      }
    }
  }

  private stripUnknownFields(data: any, schema: ValidationSchema): void {
    for (const field in data) {
      if (!(field in schema)) {
        delete data[field];
      }
    }
  }

  private async validateFields(
    data: any,
    schema: ValidationSchema,
    result: ValidationResult,
    pathPrefix: string
  ): Promise<void> {
    for (const field in schema) {
      const rules = schema[field];
      const value = data?.[field];
      const fieldPath = pathPrefix ? `${pathPrefix}.${field}` : field;

      if (!(await this.validateFieldRules(value, rules!, data, fieldPath, result))) {
        continue; // Skip sanitization if validation failed
      }

      // Apply sanitization if field is valid and exists
      if (data?.[field] !== undefined) {
        result.data[field] = this.sanitizeField(data[field], rules!);
      }
    }
  }

  private async validateFieldRules(
    value: any,
    rules: ValidationRule[],
    data: any,
    fieldPath: string,
    result: ValidationResult
  ): Promise<boolean> {
    // Apply each rule
    for (const rule of rules) {
      const validator = this.validators.get(rule.type);

      if (!validator) {
        throw new Error(`Unknown validator: ${rule.type}`);
      }

      try {
        const isValid = await validator(value, rule.params, data);

        if (!isValid) {
          result.valid = false;

          // Get error message
          let message = rule.message;
          if (!message) {
            message = this.messages.get(rule.type) || `Validation failed for ${rule.type}`;
            message = this.formatMessage(message, rule.params);
          }

          result.errors.push({
            path: fieldPath,
            message,
            rule: rule.type,
            params: rule.params
          });

          // Skip remaining rules for this field if validation failed
          return false;
        }
      } catch (error) {
        result.valid = false;
        result.errors.push({
          path: fieldPath,
          message: `Validation error: ${(error as Error).message}`,
          rule: rule.type,
          params: rule.params
        });

        // Skip remaining rules for this field if validation failed
        return false;
      }
    }

    return true;
  }

  private sanitizeField(value: any, rules: ValidationRule[]): any {
    let sanitizedValue = value;

    for (const rule of rules) {
      // Check if there's a sanitizer for this rule
      const sanitizerName = `${rule.type}Sanitizer`;
      const sanitizer = this.sanitizers.get(sanitizerName);

      if (sanitizer) {
        sanitizedValue = sanitizer(sanitizedValue, rule.params);
      }
    }

    return sanitizedValue;
  }
}
