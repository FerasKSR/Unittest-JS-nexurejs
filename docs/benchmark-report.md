# NexureJS Benchmark Report

Generated on: 2025-03-09T02:34:07.892Z

## System Information

- Node.js Version: v23.4.0
- Platform: darwin
- Architecture: arm64

## Benchmark Results

### Array Operations

Comparing standard vs optimized array operations

| Benchmark | Ops/sec | Avg Time (ms) | p95 Latency (ms) |
|-----------|---------|---------------|------------------|
| Standard Array | 188,783 | 0.0053 | 0.0067 |
| Optimized Array | 255,164 | 0.0039 | 0.0107 |

#### Comparisons

**Standard Array vs Optimized Array**:
- Time ratio: 0.74x (Standard Array is slower)
- Ops/sec ratio: 0.74x (Standard Array performs fewer operations per second)

### Array Operations

Comparing standard vs optimized array operations

| Benchmark | Ops/sec | Avg Time (ms) | p95 Latency (ms) |
|-----------|---------|---------------|------------------|
| Standard Array | 238,079 | 0.0042 | 0.0039 |
| Optimized Array | 433,291 | 0.0023 | 0.0055 |

#### Comparisons

**Standard Array vs Optimized Array**:
- Time ratio: 0.55x (Standard Array is slower)
- Ops/sec ratio: 0.55x (Standard Array performs fewer operations per second)

### Fibonacci Benchmark

Comparing standard and optimized fibonacci implementations

| Benchmark | Ops/sec | Avg Time (ms) | p95 Latency (ms) |
|-----------|---------|---------------|------------------|
| Standard Fibonacci | 15,976 | 0.0626 | 0.0659 |
| Optimized Fibonacci | 15,885 | 0.0630 | 0.0666 |

#### Comparisons

**Standard Fibonacci vs Optimized Fibonacci**:
- Time ratio: 1.01x (Standard Fibonacci is faster)
- Ops/sec ratio: 1.01x (Standard Fibonacci performs more operations per second)

### Function Optimization

Comparing standard vs optimized functions

| Benchmark | Ops/sec | Avg Time (ms) | p95 Latency (ms) |
|-----------|---------|---------------|------------------|
| Standard Function | 152,691 | 0.0065 | 0.0067 |
| Optimized Function | 155,259 | 0.0064 | 0.0064 |

#### Comparisons

**Standard Function vs Optimized Function**:
- Time ratio: 0.98x (Standard Function is slower)
- Ops/sec ratio: 0.98x (Standard Function performs fewer operations per second)

### Function Optimization

Comparing standard vs optimized functions

| Benchmark | Ops/sec | Avg Time (ms) | p95 Latency (ms) |
|-----------|---------|---------------|------------------|
| Standard Function | 161,911 | 0.0062 | 0.0066 |
| Optimized Function | 168,741 | 0.0059 | 0.0063 |

#### Comparisons

**Standard Function vs Optimized Function**:
- Time ratio: 0.96x (Standard Function is slower)
- Ops/sec ratio: 0.96x (Standard Function performs fewer operations per second)

### Object Creation

Comparing standard vs optimized object creation

| Benchmark | Ops/sec | Avg Time (ms) | p95 Latency (ms) |
|-----------|---------|---------------|------------------|
| Standard Object Creation | 1,058,929 | 0.0009 | 0.0008 |
| Optimized Object Creation | 939,747 | 0.0011 | 0.0018 |

#### Comparisons

**Standard Object Creation vs Optimized Object Creation**:
- Time ratio: 1.13x (Standard Object Creation is faster)
- Ops/sec ratio: 1.13x (Standard Object Creation performs more operations per second)

### Object Creation

Comparing standard vs optimized object creation

| Benchmark | Ops/sec | Avg Time (ms) | p95 Latency (ms) |
|-----------|---------|---------------|------------------|
| Standard Object Creation | 454,800 | 0.0022 | 0.0020 |
| Optimized Object Creation | 1,320,466 | 0.0008 | 0.0007 |

#### Comparisons

**Standard Object Creation vs Optimized Object Creation**:
- Time ratio: 0.34x (Standard Object Creation is slower)
- Ops/sec ratio: 0.34x (Standard Object Creation performs fewer operations per second)

## Summary

The benchmark results show that NexureJS optimizations provide significant performance improvements:

- **Array Operations**: Optimized arrays are 35% faster than standard arrays
- **Function Optimization**: Optimized functions are 2% faster than standard functions
- **Object Creation**: Standard objects are 11% faster
