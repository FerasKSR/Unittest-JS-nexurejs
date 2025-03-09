# NexureJS Benchmarks

This directory contains benchmark scripts for measuring the performance of various NexureJS components and optimizations.

## Available Benchmarks

- **HTTP Benchmark**: Tests the performance of the optimized radix router and zero-copy HTTP parser.
- **JSON Benchmark**: Tests the performance of the streaming JSON serializer/deserializer compared to standard JSON methods.
- **Worker Pool Benchmark**: Tests the performance of the adaptive worker pool under different workloads.
- **V8 Optimizer Benchmark**: Tests the performance improvements provided by the V8 optimizer.

## Running Benchmarks

### Run All Benchmarks

To run all benchmarks and generate a comprehensive report:

```bash
npm run benchmark
```

This will execute all benchmark scripts sequentially and save the results to the `benchmark-results` directory.

### Run Individual Benchmarks

To run a specific benchmark:

```bash
npm run benchmark:http
npm run benchmark:json
npm run benchmark:worker
npm run benchmark:v8
```

## Benchmark Results

Benchmark results are saved to the `benchmark-results` directory in JSON format. Each benchmark run creates its own result file with a timestamp.

The results include:
- Performance metrics (operations per second, average time, etc.)
- Memory usage statistics
- CPU usage statistics
- Percentile distributions (p50, p90, p95, p99)

## HTTP Server Benchmarking

The HTTP benchmark includes a simple HTTP server that you can benchmark with external tools like `autocannon` or `wrk`:

```bash
# First run the HTTP benchmark to start the server
npx ts-node benchmarks/http-benchmark.ts

# Then in another terminal, run autocannon
npx autocannon -c 100 -d 10 http://localhost:3000

# Or use wrk
wrk -t12 -c400 -d30s http://localhost:3000
```

## Comparing with Other Frameworks

To compare NexureJS with other frameworks, you can use the HTTP server benchmark and run similar benchmarks against other frameworks like Express, Fastify, or Koa.

## Customizing Benchmarks

You can customize the benchmarks by modifying the benchmark scripts. Each script includes configuration options for:
- Number of iterations
- Warmup iterations
- Time budget
- Memory and CPU usage collection
- Optimization settings

## Interpreting Results

The benchmark results include various metrics to help you understand the performance characteristics of NexureJS components:

- **Operations per second**: Higher is better
- **Average time per operation**: Lower is better
- **Memory usage**: Lower is better
- **Standard deviation**: Lower indicates more consistent performance
- **Percentiles**: Lower values at higher percentiles (p95, p99) indicate better worst-case performance

## Contributing

If you develop new optimizations or components for NexureJS, please add corresponding benchmark scripts to measure their performance impact.
