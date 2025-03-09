import { parentPort, workerData } from 'node:worker_threads';

// Initialize worker with data
console.log('Worker initialized with data:', workerData);

// Listen for messages from the main thread
parentPort.on('message', (task) => {
  console.log(`Worker received task: ${task.type} (${task.id})`);

  try {
    // Process the task based on its type
    let result;

    switch (task.type) {
      case 'fibonacci':
        result = computeFibonacci(task.data);
        break;
      case 'prime':
        result = isPrime(task.data);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    // Send the result back to the main thread
    parentPort.postMessage({
      taskId: task.id,
      data: result
    });
  } catch (error) {
    // Send the error back to the main thread
    parentPort.postMessage({
      taskId: task.id,
      error: error.message
    });
  }
});

/**
 * Compute the nth Fibonacci number
 * @param n The index of the Fibonacci number to compute
 */
function computeFibonacci(n) {
  if (n <= 1) return n;
  return computeFibonacci(n - 1) + computeFibonacci(n - 2);
}

/**
 * Check if a number is prime
 * @param n The number to check
 */
function isPrime(n) {
  if (n <= 1) return false;
  if (n <= 3) return true;

  if (n % 2 === 0 || n % 3 === 0) return false;

  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }

  return true;
}
