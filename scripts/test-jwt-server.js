/**
 * JWT Authentication Server Test
 *
 * This script tests the JWT authentication server by:
 * 1. Getting a JWT token from the login endpoint
 * 2. Using the token to access a protected endpoint
 * 3. Trying to access a protected endpoint without a token
 */

import http from 'node:http';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// Print header
console.log(`${colors.bright}${colors.blue}=== NexureJS JWT Authentication Server Test ===${colors.reset}\n`);

// Make HTTP request
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, data: parsedData });
        } catch (error) {
          resolve({ statusCode: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test login
async function testLogin() {
  console.log(`${colors.yellow}Testing login endpoint...${colors.reset}`);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const data = {
    username: 'admin',
    password: 'admin123'
  };

  console.log(`${colors.dim}Request: ${JSON.stringify(options)}${colors.reset}`);
  console.log(`${colors.dim}Data: ${JSON.stringify(data)}${colors.reset}`);

  try {
    const response = await makeRequest(options, data);

    console.log(`${colors.dim}Response status: ${response.statusCode}${colors.reset}`);
    console.log(`${colors.dim}Response data: ${JSON.stringify(response.data)}${colors.reset}`);

    if (response.statusCode === 200 && response.data.token) {
      console.log(`${colors.green}✓ Login successful${colors.reset}`);
      console.log(`${colors.dim}Token: ${response.data.token.substring(0, 20)}...${colors.reset}`);
      return response.data.token;
    } else {
      console.error(`${colors.red}✗ Login failed: ${JSON.stringify(response.data)}${colors.reset}`);
      return null;
    }
  } catch (error) {
    console.error(`${colors.red}✗ Login request failed: ${error.message}${colors.reset}`);
    return null;
  }
}

// Test protected route with token
async function testProtectedRouteWithToken(token) {
  console.log(`\n${colors.yellow}Testing protected route with token...${colors.reset}`);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/profile',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  try {
    const response = await makeRequest(options);

    if (response.statusCode === 200) {
      console.log(`${colors.green}✓ Access granted to protected route${colors.reset}`);
      console.log(`${colors.dim}Response: ${JSON.stringify(response.data)}${colors.reset}`);
      return true;
    } else {
      console.error(`${colors.red}✗ Access denied: ${JSON.stringify(response.data)}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}✗ Request failed: ${error.message}${colors.reset}`);
    return false;
  }
}

// Test protected route without token
async function testProtectedRouteWithoutToken() {
  console.log(`\n${colors.yellow}Testing protected route without token...${colors.reset}`);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/profile',
    method: 'GET'
  };

  try {
    const response = await makeRequest(options);

    if (response.statusCode === 401) {
      console.log(`${colors.green}✓ Access correctly denied (401 Unauthorized)${colors.reset}`);
      return true;
    } else {
      console.error(`${colors.red}✗ Unexpected response: ${response.statusCode} ${JSON.stringify(response.data)}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}✗ Request failed: ${error.message}${colors.reset}`);
    return false;
  }
}

// Test admin route with admin token
async function testAdminRouteWithAdminToken(token) {
  console.log(`\n${colors.yellow}Testing admin route with admin token...${colors.reset}`);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  try {
    const response = await makeRequest(options);

    if (response.statusCode === 200) {
      console.log(`${colors.green}✓ Access granted to admin route${colors.reset}`);
      console.log(`${colors.dim}Response: ${JSON.stringify(response.data).substring(0, 100)}...${colors.reset}`);
      return true;
    } else {
      console.error(`${colors.red}✗ Access denied: ${JSON.stringify(response.data)}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}✗ Request failed: ${error.message}${colors.reset}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  try {
    // Check if server is running
    try {
      await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/',
        method: 'GET'
      });
      console.log(`${colors.green}✓ Server is running${colors.reset}\n`);
    } catch (error) {
      console.error(`${colors.red}✗ Server is not running. Please start the server first.${colors.reset}`);
      process.exit(1);
    }

    // Test login
    const token = await testLogin();

    if (!token) {
      console.error(`${colors.red}✗ Cannot proceed with tests without a valid token${colors.reset}`);
      process.exit(1);
    }

    // Test protected route with token
    await testProtectedRouteWithToken(token);

    // Test protected route without token
    await testProtectedRouteWithoutToken();

    // Test admin route with admin token
    await testAdminRouteWithAdminToken(token);

    console.log(`\n${colors.bright}${colors.green}✓ All tests completed!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗ Tests failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
runTests();
