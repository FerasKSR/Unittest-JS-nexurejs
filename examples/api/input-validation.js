/**
 * Input Validation Example
 *
 * This example demonstrates how to implement robust input validation for API endpoints:
 * - Schema-based validation
 * - Custom validation rules
 * - Error handling
 * - Reusable validation middleware
 *
 * For complete API documentation, see:
 * - API Reference: ../../docs/API_REFERENCE.md
 * - Examples Guide: ../../docs/EXAMPLES.md
 */

import { Nexure, HttpMethod } from '../../src/index.js';

// Create a new Nexure application instance
const app = new Nexure({
  logger: {
    level: 'info',
    prettyPrint: true
  }
});

// -----------------------------------
// Validation Helper Functions
// -----------------------------------

// Helper to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
};

// Helper to validate string length
const isValidStringLength = (str, min, max) => {
  if (typeof str !== 'string') return false;
  const length = str.length;
  return length >= min && length <= max;
};

// Helper to validate age range
const isValidAge = (age) => {
  return Number.isInteger(age) && age >= 18 && age <= 120;
};

// Helper to validate URL format
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};

// -----------------------------------
// Validation Middleware Factory
// -----------------------------------

// Create reusable validation middleware
const createValidationMiddleware = (schema) => {
  return async (req, res, next) => {
    try {
      // Parse request body if it hasn't been parsed yet
      const body = req.body || await req.json();
      req.body = body;

      // Validate against schema
      const errors = [];

      // Check required fields
      for (const field of schema.required || []) {
        if (body[field] === undefined) {
          errors.push({
            field,
            message: `Field '${field}' is required`
          });
        }
      }

      // Validate field types and constraints
      for (const [field, rules] of Object.entries(schema.properties || {})) {
        // Skip if field is not present and not required
        if (body[field] === undefined) continue;

        const value = body[field];

        // Type validation
        if (rules.type && typeof value !== rules.type) {
          errors.push({
            field,
            message: `Field '${field}' must be a ${rules.type}`
          });
          continue;
        }

        // String specific validations
        if (rules.type === 'string') {
          // Min/max length
          if (rules.minLength !== undefined || rules.maxLength !== undefined) {
            const min = rules.minLength || 0;
            const max = rules.maxLength || Infinity;

            if (!isValidStringLength(value, min, max)) {
              errors.push({
                field,
                message: `Field '${field}' must be between ${min} and ${max} characters long`
              });
            }
          }

          // Format validation
          if (rules.format) {
            switch (rules.format) {
              case 'email':
                if (!isValidEmail(value)) {
                  errors.push({
                    field,
                    message: `Field '${field}' must be a valid email address`
                  });
                }
                break;
              case 'url':
                if (!isValidUrl(value)) {
                  errors.push({
                    field,
                    message: `Field '${field}' must be a valid URL`
                  });
                }
                break;
            }
          }

          // Pattern validation
          if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
            errors.push({
              field,
              message: rules.patternMessage || `Field '${field}' does not match required pattern`
            });
          }
        }

        // Number specific validations
        if (rules.type === 'number' || rules.type === 'integer') {
          // Min/max value
          if (rules.minimum !== undefined && value < rules.minimum) {
            errors.push({
              field,
              message: `Field '${field}' must be at least ${rules.minimum}`
            });
          }

          if (rules.maximum !== undefined && value > rules.maximum) {
            errors.push({
              field,
              message: `Field '${field}' must be at most ${rules.maximum}`
            });
          }

          // Integer validation
          if (rules.type === 'integer' && !Number.isInteger(value)) {
            errors.push({
              field,
              message: `Field '${field}' must be an integer`
            });
          }
        }

        // Custom validator
        if (rules.validator && typeof rules.validator === 'function') {
          try {
            const result = rules.validator(value, body);
            if (result !== true) {
              errors.push({
                field,
                message: result || `Field '${field}' validation failed`
              });
            }
          } catch (err) {
            errors.push({
              field,
              message: err.message || `Field '${field}' validation failed with an error`
            });
          }
        }
      }

      // If there are validation errors, return error response
      if (errors.length > 0) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors
        });
      }

      // Validation passed, proceed to next middleware
      next();
    } catch (err) {
      // Error parsing JSON or other unexpected error
      res.status(400).json({
        error: 'Invalid Request',
        message: err.message || 'Request body cannot be parsed'
      });
    }
  };
};

// -----------------------------------
// Schema Definitions
// -----------------------------------

// User creation schema
const userSchema = {
  required: ['name', 'email', 'password'],
  properties: {
    name: {
      type: 'string',
      minLength: 2,
      maxLength: 50
    },
    email: {
      type: 'string',
      format: 'email'
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 100,
      validator: (value) => {
        // Password strength validation
        const hasUppercase = /[A-Z]/.test(value);
        const hasLowercase = /[a-z]/.test(value);
        const hasNumber = /[0-9]/.test(value);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);

        if (!hasUppercase) {
          return 'Password must contain at least one uppercase letter';
        }
        if (!hasLowercase) {
          return 'Password must contain at least one lowercase letter';
        }
        if (!hasNumber) {
          return 'Password must contain at least one number';
        }
        if (!hasSpecial) {
          return 'Password must contain at least one special character';
        }

        return true;
      }
    },
    age: {
      type: 'integer',
      minimum: 18,
      maximum: 120
    },
    website: {
      type: 'string',
      format: 'url'
    },
    phone: {
      type: 'string',
      pattern: '^[0-9\\-\\+\\s\\(\\)]+$',
      patternMessage: 'Phone number can only contain digits, spaces, and the following characters: + - ( )'
    }
  }
};

// Product creation schema
const productSchema = {
  required: ['name', 'price'],
  properties: {
    name: {
      type: 'string',
      minLength: 2,
      maxLength: 100
    },
    description: {
      type: 'string',
      maxLength: 1000
    },
    price: {
      type: 'number',
      minimum: 0.01
    },
    category: {
      type: 'string',
      validator: (value) => {
        const validCategories = ['electronics', 'clothing', 'food', 'books', 'other'];
        if (!validCategories.includes(value)) {
          return `Category must be one of: ${validCategories.join(', ')}`;
        }
        return true;
      }
    },
    inStock: {
      type: 'boolean'
    },
    tags: {
      validator: (value) => {
        if (!Array.isArray(value)) {
          return 'Tags must be an array';
        }

        for (const tag of value) {
          if (typeof tag !== 'string') {
            return 'Each tag must be a string';
          }
        }

        return true;
      }
    }
  }
};

// -----------------------------------
// Route Definitions with Validation
// -----------------------------------

// User registration endpoint
app.route({
  path: '/api/users',
  method: HttpMethod.POST,
  middleware: [createValidationMiddleware(userSchema)],
  handler: (req, res) => {
    // At this point, validation has passed and we can process the data
    // In a real app, you would hash the password and save to a database

    const { password, ...safeUserData } = req.body;

    res.status(201).json({
      message: 'User created successfully',
      user: safeUserData
    });
  }
});

// Product creation endpoint
app.route({
  path: '/api/products',
  method: HttpMethod.POST,
  middleware: [createValidationMiddleware(productSchema)],
  handler: (req, res) => {
    // At this point, validation has passed and we can process the data
    // In a real app, you would save to a database

    const product = {
      id: Date.now(), // Simple ID generation for demo
      ...req.body,
      createdAt: new Date().toISOString()
    };

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  }
});

// -----------------------------------
// Demo routes
// -----------------------------------

// Home route to show API documentation
app.route({
  path: '/',
  method: HttpMethod.GET,
  handler: (req, res) => {
    res.status(200).json({
      message: 'Input Validation Demo API',
      documentation: {
        createUser: {
          method: 'POST',
          path: '/api/users',
          schema: userSchema,
          example: {
            name: 'John Doe',
            email: 'john@example.com',
            password: 'SecureP@ss123',
            age: 30,
            website: 'https://example.com',
            phone: '+1 (555) 123-4567'
          }
        },
        createProduct: {
          method: 'POST',
          path: '/api/products',
          schema: productSchema,
          example: {
            name: 'Smartphone',
            description: 'Latest model with advanced features',
            price: 599.99,
            category: 'electronics',
            inStock: true,
            tags: ['tech', 'gadget', 'smartphone']
          }
        }
      }
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`
  });
});

// -----------------------------------
// Start the server
// -----------------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Input validation demo server running at http://localhost:${port}`);
  console.log('Try these example requests:');
  console.log('\n1. Create a valid user:');
  console.log(`curl -X POST http://localhost:${port}/api/users \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"name":"John Doe","email":"john@example.com","password":"SecureP@ss123","age":30}\'');

  console.log('\n2. Try invalid user data:');
  console.log(`curl -X POST http://localhost:${port}/api/users \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"name":"J","email":"not-an-email","password":"weak"}\'');

  console.log('\n3. Create a valid product:');
  console.log(`curl -X POST http://localhost:${port}/api/products \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"name":"Smartphone","price":599.99,"category":"electronics","inStock":true}\'');

  console.log('\n4. Try invalid product data:');
  console.log(`curl -X POST http://localhost:${port}/api/products \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"name":"X","price":-10,"category":"invalid"}\'');
});
