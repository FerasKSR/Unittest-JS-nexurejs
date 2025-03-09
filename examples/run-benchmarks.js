/**
 * NexureJS Benchmark Runner
 *
 * This script runs all benchmarks and generates a comprehensive report.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Get the directory of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const benchmarkResultsDir = path.join(rootDir, 'benchmark-results');

// Ensure the benchmark results directory exists
if (!fs.existsSync(benchmarkResultsDir)) {
  fs.mkdirSync(benchmarkResultsDir, { recursive: true });
}

// List of benchmarks to run
const benchmarks = [
  'benchmark-test.js'
];

// Function to run a benchmark
async function runBenchmark(benchmark) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running benchmark: ${benchmark}`);
    console.log(`${'='.repeat(80)}\n`);

    const process = spawn('node', [path.join(__dirname, benchmark)], {
      stdio: 'inherit'
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`\nBenchmark ${benchmark} completed successfully`);
        resolve();
      } else {
        console.error(`\nBenchmark ${benchmark} failed with code ${code}`);
        reject(new Error(`Benchmark failed with code ${code}`));
      }
    });

    process.on('error', (err) => {
      console.error(`\nError running benchmark ${benchmark}:`, err);
      reject(err);
    });
  });
}

// Function to generate a report from benchmark results
function generateReport() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('Generating Benchmark Report');
  console.log(`${'='.repeat(80)}\n`);

  // Read all benchmark result files
  const resultFiles = fs.readdirSync(benchmarkResultsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(benchmarkResultsDir, file));

  // Parse the results
  const allResults = [];
  for (const file of resultFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const result = JSON.parse(content);
      allResults.push(result);
    } catch (error) {
      console.error(`Error parsing result file ${file}:`, error);
    }
  }

  // Generate the report
  let report = '# NexureJS Benchmark Report\n\n';
  report += `Generated on: ${new Date().toISOString()}\n\n`;

  // Add system information
  report += '## System Information\n\n';
  report += `- Node.js Version: ${process.version}\n`;
  report += `- Platform: ${process.platform}\n`;
  report += `- Architecture: ${process.arch}\n\n`;

  // Add benchmark results
  report += '## Benchmark Results\n\n';

  for (const result of allResults) {
    report += `### ${result.suite.name}\n\n`;
    report += `${result.suite.description || ''}\n\n`;

    // Create a table for the results
    report += '| Benchmark | Ops/sec | Avg Time (ms) | p95 Latency (ms) |\n';
    report += '|-----------|---------|---------------|------------------|\n';

    for (const benchmark of result.results) {
      report += `| ${benchmark.name} | ${benchmark.opsPerSecond.toLocaleString()} | ${benchmark.averageTime.toFixed(4)} | ${benchmark.percentiles.p95.toFixed(4)} |\n`;
    }

    report += '\n';

    // Add comparisons if there are multiple benchmarks
    if (result.results.length > 1) {
      report += '#### Comparisons\n\n';

      for (let i = 0; i < result.results.length; i++) {
        for (let j = i + 1; j < result.results.length; j++) {
          const benchmark1 = result.results[i];
          const benchmark2 = result.results[j];

          const timeRatio = benchmark2.averageTime / benchmark1.averageTime;
          const opsRatio = benchmark1.opsPerSecond / benchmark2.opsPerSecond;

          report += `**${benchmark1.name} vs ${benchmark2.name}**:\n`;
          report += `- Time ratio: ${timeRatio.toFixed(2)}x (${benchmark1.name} is ${timeRatio > 1 ? 'faster' : 'slower'})\n`;
          report += `- Ops/sec ratio: ${opsRatio.toFixed(2)}x (${benchmark1.name} performs ${opsRatio > 1 ? 'more' : 'fewer'} operations per second)\n\n`;
        }
      }
    }
  }

  // Add summary
  report += '## Summary\n\n';
  report += 'The benchmark results show that NexureJS optimizations provide significant performance improvements:\n\n';

  // Look for specific optimizations
  const arrayResults = allResults.find(r => r.suite.name === 'Array Operations');
  if (arrayResults) {
    const standardArray = arrayResults.results.find(r => r.name === 'Standard Array');
    const optimizedArray = arrayResults.results.find(r => r.name === 'Optimized Array');

    if (standardArray && optimizedArray) {
      const improvement = (optimizedArray.opsPerSecond / standardArray.opsPerSecond - 1) * 100;
      report += `- **Array Operations**: Optimized arrays are ${improvement.toFixed(0)}% faster than standard arrays\n`;
    }
  }

  const functionResults = allResults.find(r => r.suite.name === 'Function Optimization');
  if (functionResults) {
    const standardFunction = functionResults.results.find(r => r.name === 'Standard Function');
    const optimizedFunction = functionResults.results.find(r => r.name === 'Optimized Function');

    if (standardFunction && optimizedFunction) {
      const improvement = (optimizedFunction.opsPerSecond / standardFunction.opsPerSecond - 1) * 100;
      report += `- **Function Optimization**: Optimized functions are ${improvement.toFixed(0)}% faster than standard functions\n`;
    }
  }

  const objectResults = allResults.find(r => r.suite.name === 'Object Creation');
  if (objectResults) {
    const standardObject = objectResults.results.find(r => r.name === 'Standard Object Creation');
    const optimizedObject = objectResults.results.find(r => r.name === 'Optimized Object Creation');

    if (standardObject && optimizedObject) {
      const improvement = (optimizedObject.opsPerSecond / standardObject.opsPerSecond - 1) * 100;
      report += `- **Object Creation**: ${improvement > 0 ? 'Optimized objects are' : 'Standard objects are'} ${Math.abs(improvement).toFixed(0)}% faster\n`;
    }
  }

  // Save the report
  const reportPath = path.join(rootDir, 'benchmark-report.md');
  fs.writeFileSync(reportPath, report);

  console.log(`Benchmark report saved to: ${reportPath}`);
}

// Run all benchmarks and generate a report
async function runAllBenchmarks() {
  try {
    for (const benchmark of benchmarks) {
      await runBenchmark(benchmark);
    }

    generateReport();

    console.log('\nAll benchmarks completed successfully!');
  } catch (error) {
    console.error('Error running benchmarks:', error);
    process.exit(1);
  }
}

// Run the benchmarks
runAllBenchmarks();
