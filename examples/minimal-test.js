import { Nexure } from '../dist/core/nexure.js';

// Create a new app
const app = new Nexure({
  logging: true,
  prettyJson: true
});

// Add basic request handler
app.use((req, res) => {
  res.end(JSON.stringify({
    message: 'Hello from minimal NexureJS!',
    timestamp: new Date().toISOString()
  }, null, 2));
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
