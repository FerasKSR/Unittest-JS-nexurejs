import 'reflect-metadata';
import { createServer } from 'node:http';

// Create a simple HTTP server
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'NexureJS is working!',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  }));
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('This is a simple test server to verify that Node.js is working correctly.');
  console.log('The actual NexureJS framework is still in development.');
});
