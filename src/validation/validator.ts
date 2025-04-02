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
  rule?: string;

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
  data?: any;
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
  [key: string]:
    | ValidationRule[]
    | string
    | boolean
    | number
    | undefined
    | {
        required?: string;
        type?: string;
        format?: string;
        min?: string;
        max?: string;
      };
  path: string;
  required?: boolean;
  type?: string;
  format?: string;
  min?: number;
  max?: number;
  messages?: {
    required?: string;
    type?: string;
    format?: string;
    min?: string;
    max?: string;
  };
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
 * Base validator class with common validation logic
 */
class BaseValidator {
  protected validators = new Map<string, ValidatorFunction>();
  protected sanitizers = new Map<string, SanitizerFunction>();
  protected messages = new Map<string, string>();

  public registerValidator(name: string, validator: ValidatorFunction): void {
    this.validators.set(name, validator);
  }

  public registerSanitizer(name: string, sanitizer: SanitizerFunction): void {
    this.sanitizers.set(name, sanitizer);
  }

  public registerMessage(name: string, message: string): void {
    this.messages.set(name, message);
  }

  public getValidator(name: string): ValidatorFunction | undefined {
    return this.validators.get(name);
  }
}

/**
 * Type validator class for basic type validation
 */
class TypeValidator extends BaseValidator {
  constructor() {
    super();
    this.registerBasicValidators();
  }

  private registerBasicValidators(): void {
    this.registerValidator('string', value => typeof value === 'string');
    this.registerValidator('number', value => typeof value === 'number' && !isNaN(value));
    this.registerValidator('boolean', value => typeof value === 'boolean');
    this.registerValidator('array', value => Array.isArray(value));
    this.registerValidator(
      'object',
      value => typeof value === 'object' && value !== null && !Array.isArray(value)
    );
  }
}

/**
 * Format validator class for specific format validation
 */
class FormatValidator extends BaseValidator {
  constructor() {
    super();
    this.registerFormatValidators();
  }

  private registerFormatValidators(): void {
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
  }
}

/**
 * Range validator class for min/max validation
 */
class RangeValidator extends BaseValidator {
  constructor() {
    super();
    this.registerRangeValidators();
  }

  private registerRangeValidators(): void {
    this.registerValidator('min', (value, params) => {
      if (typeof value === 'number') return value >= params!.min;
      if (typeof value === 'string' || Array.isArray(value)) {
        return value.length >= params!.min;
      }
      return false;
    });

    this.registerValidator('max', (value, params) => {
      if (typeof value === 'number') return value <= params!.max;
      if (typeof value === 'string' || Array.isArray(value)) {
        return value.length <= params!.max;
      }
      return false;
    });
  }
}

/**
 * Main validator class that combines all validators
 */
export class Validator {
  private typeValidator: TypeValidator;
  private formatValidator: FormatValidator;
  private rangeValidator: RangeValidator;

  constructor() {
    this.typeValidator = new TypeValidator();
    this.formatValidator = new FormatValidator();
    this.rangeValidator = new RangeValidator();
  }

  /**
   * Validate a value against a schema
   */
  validate(value: any, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];

    // Process validations in sequence
    this.validateRequired(value, schema, errors);

    // Skip other validations if required check failed
    if (errors.length === 0 || value !== undefined) {
      this.validateType(value, schema, errors);
      this.validateFormat(value, schema, errors);
      this.validateRange(value, schema, errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      data: value
    };
  }

  /**
   * Validate required field
   */
  private validateRequired(value: any, schema: ValidationSchema, errors: ValidationError[]): void {
    if (schema.required && (value === undefined || value === null)) {
      errors.push({
        path: schema.path,
        message: schema.messages?.required || 'This field is required',
        rule: 'required'
      });
    }
  }

  /**
   * Validate type
   */
  private validateType(value: any, schema: ValidationSchema, errors: ValidationError[]): void {
    if (schema.type && value !== undefined && value !== null) {
      const typeValidator = this.typeValidator.getValidator(schema.type);
      if (typeValidator && !typeValidator(value)) {
        errors.push({
          path: schema.path,
          message: schema.messages?.type || `Invalid ${schema.type}`,
          rule: 'type'
        });
      }
    }
  }

  /**
   * Validate format
   */
  private validateFormat(value: any, schema: ValidationSchema, errors: ValidationError[]): void {
    if (schema.format && value !== undefined && value !== null) {
      const formatValidator = this.formatValidator.getValidator(schema.format);
      if (formatValidator && !formatValidator(value)) {
        errors.push({
          path: schema.path,
          message: schema.messages?.format || `Invalid ${schema.format} format`,
          rule: 'format'
        });
      }
    }
  }

  /**
   * Validate range constraints
   */
  private validateRange(value: any, schema: ValidationSchema, errors: ValidationError[]): void {
    this.validateMin(value, schema, errors);
    this.validateMax(value, schema, errors);
  }

  /**
   * Validate minimum value/length
   */
  private validateMin(value: any, schema: ValidationSchema, errors: ValidationError[]): void {
    if (schema.min !== undefined && value !== undefined && value !== null) {
      const minValidator = this.rangeValidator.getValidator('min');
      if (minValidator && !minValidator(value, { min: schema.min })) {
        errors.push({
          path: schema.path,
          message: schema.messages?.min || `Value must be at least ${schema.min}`,
          rule: 'min',
          params: { min: schema.min }
        });
      }
    }
  }

  /**
   * Validate maximum value/length
   */
  private validateMax(value: any, schema: ValidationSchema, errors: ValidationError[]): void {
    if (schema.max !== undefined && value !== undefined && value !== null) {
      const maxValidator = this.rangeValidator.getValidator('max');
      if (maxValidator && !maxValidator(value, { max: schema.max })) {
        errors.push({
          path: schema.path,
          message: schema.messages?.max || `Value must be at most ${schema.max}`,
          rule: 'max',
          params: { max: schema.max }
        });
      }
    }
  }
}
