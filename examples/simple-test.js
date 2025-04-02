import { Nexure } from '../dist/index.js';
import { Router } from '../dist/routing/index.js';

// Create a new Nexure instance
const app = new Nexure({
  logging: true,
  prettyJson: true
});

// Create a router
const router = new Router();

// Define a route
router.get('/', (req, res) => {
  res.end(JSON.stringify({
    message: 'Hello from NexureJS!',
    timestamp: new Date().toISOString()
  }, null, 2));
});

// Register the router
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  return next();
});

app.use(async (req, res, next) => {
  await router.process(req, res);
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
