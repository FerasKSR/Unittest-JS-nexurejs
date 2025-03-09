/**
 * Simple test application to verify NexureJS is working properly
 */

import { Nexure } from '../src/index.js';

// Create a simple application
const app = new Nexure({
  logging: true,
  prettyJson: true
});

// Add some routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello from NexureJS!' });
});

app.get('/json', (req, res) => {
  res.json({
    framework: 'NexureJS',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    features: [
      'High Performance',
      'Developer Experience',
      'TypeScript Support',
      'Memory Efficiency',
      'Scalability'
    ]
  });
});

// Start the server
const port = 3001;
app.listen(port, () => {
  console.log(`Test application is running at http://localhost:${port}/`);
  console.log('Available routes:');
  console.log(`  GET http://localhost:${port}/`);
  console.log(`  GET http://localhost:${port}/json`);
});
