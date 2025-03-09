/**
 * V8 Optimizer Performance Benchmark for NexureJS
 *
 * This benchmark tests the performance improvements provided by the V8 optimizer
 * for various JavaScript patterns and operations.
 */

import { Benchmark, BenchmarkSuite } from '../src/utils/performance-benchmark.js';
import { v8Optimizer } from '../src/utils/v8-optimizer.js';

// Run the benchmarks
async function runBenchmarks() {
  console.log('Starting V8 Optimizer Performance Benchmarks');

  // 1. Object Creation Benchmarks
  const objectSuite = new BenchmarkSuite({
    name: 'Object Creation Optimization',
    description: 'Testing optimized vs standard object creation patterns',
    baseOptions: {
      iterations: 100000,
      warmup: 1000,
      collectMemoryStats: true
    }
  });

  // Standard object creation
  objectSuite.add(() => {
    const objects = [];
    for (let i = 0; i < 1000; i++) {
      objects.push({
        id: i,
        name: `Item ${i}`,
        value: i * 1.5,
        active: i % 2 === 0
      });
    }
    return objects.length;
  }, {
    name: 'Standard Object Creation',
    description: 'Creating objects with standard object literals'
  });

  // Optimized object creation
  objectSuite.add(() => {
    const objects = [];
    const template = v8Optimizer.createOptimizedObject({
      id: 0,
      name: '',
      value: 0,
      active: false
    });

    for (let i = 0; i < 1000; i++) {
      const obj = v8Optimizer.createOptimizedObject(template);
      obj.id = i;
      obj.name = `Item ${i}`;
      obj.value = i * 1.5;
      obj.active = i % 2 === 0;
      objects.push(obj);
    }
    return objects.length;
  }, {
    name: 'Optimized Object Creation',
    description: 'Creating objects with optimized object patterns'
  });

  // Inline properties object creation
  objectSuite.add(() => {
    const objects = [];
    for (let i = 0; i < 1000; i++) {
      objects.push(v8Optimizer.createOptimizedObject({
        id: i,
        name: `Item ${i}`,
        value: i * 1.5,
        active: i % 2 === 0
      }));
    }
    return objects.length;
  }, {
    name: 'Inline Properties Object Creation',
    description: 'Creating objects with inline properties optimization'
  });

  // Run object creation benchmarks
  const objectResults = await objectSuite.run();
  console.log(objectSuite.compareResults('Standard Object Creation', 'Optimized Object Creation', objectResults));
  console.log(objectSuite.compareResults('Standard Object Creation', 'Inline Properties Object Creation', objectResults));
  objectSuite.saveResults(objectResults);

  // 2. Array Operations Benchmarks
  const arraySuite = new BenchmarkSuite({
    name: 'Array Operations Optimization',
    description: 'Testing optimized vs standard array operations',
    baseOptions: {
      iterations: 10000,
      warmup: 100,
      collectMemoryStats: true
    }
  });

  // Standard array creation and operations
  arraySuite.add(() => {
    const arrays = [];
    for (let i = 0; i < 100; i++) {
      const arr = [];
      for (let j = 0; j < 1000; j++) {
        arr.push(j);
      }
      arrays.push(arr);
    }

    // Perform some operations
    let sum = 0;
    for (const arr of arrays) {
      sum += arr.reduce((a, b) => a + b, 0);
    }
    return sum;
  }, {
    name: 'Standard Array Operations',
    description: 'Creating and operating on arrays with standard patterns'
  });

  // Optimized array creation and operations
  arraySuite.add(() => {
    const arrays = [];
    for (let i = 0; i < 100; i++) {
      const arr = v8Optimizer.createFastArray(1000, 'number');
      for (let j = 0; j < 1000; j++) {
        arr[j] = j;
      }
      arrays.push(arr);
    }

    // Perform some operations
    let sum = 0;
    for (const arr of arrays) {
      for (let j = 0; j < arr.length; j++) {
        sum += arr[j] as number;
      }
    }
    return sum;
  }, {
    name: 'Optimized Array Operations',
    description: 'Creating and operating on arrays with optimized patterns'
  });

  // Run array operations benchmarks
  const arrayResults = await arraySuite.run();
  console.log(arraySuite.compareResults('Standard Array Operations', 'Optimized Array Operations', arrayResults));
  arraySuite.saveResults(arrayResults);

  // 3. Function Optimization Benchmarks
  const functionSuite = new BenchmarkSuite({
    name: 'Function Optimization',
    description: 'Testing optimized vs standard function calls',
    baseOptions: {
      iterations: 100000,
      warmup: 1000,
      collectMemoryStats: true
    }
  });

  // Standard function
  function standardCalculation(a: number, b: number): number {
    return a * a + b * b + 2 * a * b;
  }

  // Optimized function
  const optimizedCalculation = v8Optimizer.optimizeFunction(
    (a: number, b: number): number => {
      return a * a + b * b + 2 * a * b;
    }
  );

  // Monomorphic function
  class Calculator {
    calculate(a: number, b: number): number {
      return a * a + b * b + 2 * a * b;
    }
  }

  const calculator = new Calculator();
  const monomorphicCalculate = v8Optimizer.createMonomorphicCallSite(
    calculator.calculate.bind(calculator)
  );

  // Add function benchmarks
  functionSuite.add(() => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += standardCalculation(i, i + 1);
    }
    return sum;
  }, {
    name: 'Standard Function Calls',
    description: 'Calling standard functions'
  });

  functionSuite.add(() => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += optimizedCalculation(i, i + 1);
    }
    return sum;
  }, {
    name: 'Optimized Function Calls',
    description: 'Calling optimized functions'
  });

  functionSuite.add(() => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += monomorphicCalculate(i, i + 1);
    }
    return sum;
  }, {
    name: 'Monomorphic Function Calls',
    description: 'Calling monomorphic functions'
  });

  // Run function optimization benchmarks
  const functionResults = await functionSuite.run();
  console.log(functionSuite.compareResults('Standard Function Calls', 'Optimized Function Calls', functionResults));
  console.log(functionSuite.compareResults('Standard Function Calls', 'Monomorphic Function Calls', functionResults));
  functionSuite.saveResults(functionResults);

  // 4. Class Optimization Benchmarks
  const classSuite = new BenchmarkSuite({
    name: 'Class Optimization',
    description: 'Testing optimized vs standard class usage',
    baseOptions: {
      iterations: 10000,
      warmup: 100,
      collectMemoryStats: true
    }
  });

  // Standard class
  class StandardItem {
    id: number;
    name: string;
    value: number;

    constructor(id: number, name: string, value: number) {
      this.id = id;
      this.name = name;
      this.value = value;
    }

    getValue(): number {
      return this.value;
    }

    setValue(value: number): void {
      this.value = value;
    }
  }

  // Optimized class
  const OptimizedItemClass = v8Optimizer.optimizeClass(
    class OptimizedItem {
      id: number;
      name: string;
      value: number;

      constructor(id: number, name: string, value: number) {
        this.id = id;
        this.name = name;
        this.value = value;
      }

      getValue(): number {
        return this.value;
      }

      setValue(value: number): void {
        this.value = value;
      }
    }
  );

  // Add class benchmarks
  classSuite.add(() => {
    const items = [];
    for (let i = 0; i < 1000; i++) {
      const item = new StandardItem(i, `Item ${i}`, i * 1.5);
      item.setValue(item.getValue() * 2);
      items.push(item);
    }
    return items.length;
  }, {
    name: 'Standard Class Usage',
    description: 'Creating and using standard classes'
  });

  classSuite.add(() => {
    const items = [];
    for (let i = 0; i < 1000; i++) {
      const item = new OptimizedItemClass(i, `Item ${i}`, i * 1.5);
      item.setValue(item.getValue() * 2);
      items.push(item);
    }
    return items.length;
  }, {
    name: 'Optimized Class Usage',
    description: 'Creating and using optimized classes'
  });

  // Run class optimization benchmarks
  const classResults = await classSuite.run();
  console.log(classSuite.compareResults('Standard Class Usage', 'Optimized Class Usage', classResults));
  classSuite.saveResults(classResults);
}

// Run the benchmarks
runBenchmarks().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
