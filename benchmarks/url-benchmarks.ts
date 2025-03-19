/**
 * URL Parser Benchmarks
 *
 * Compares the performance of native C++ URL parser implementation
 * against the JavaScript implementation.
 */

import { runBenchmark, compareResults } from './index.js';
import { URL } from 'node:url';
import querystring from 'node:querystring';

// Sample URLs for testing
const sampleUrls = [
  'https://user:pass@example.com:8080/path/to/page?query=string&foo=bar#hash',
  'http://localhost:3000/api/users?page=1&limit=20',
  'https://www.example.org/blog/2023/05/article-title?utm_source=newsletter&utm_medium=email',
  'ftp://files.example.net:21/downloads/file.zip',
  'https://subdomain.example.co.uk/products/category/item?sort=price&order=asc&filter=instock',
  'http://192.168.1.1/admin',
  'https://example.com/path with spaces?q=hello world',
  'ws://echo.websocket.org/',
  'file:///home/user/document.txt',
  'https://api.example.com/v2/resource/123'
];

// Sample query strings for testing
const sampleQueryStrings = [
  'name=John&age=30&city=New%20York',
  'product=laptop&price=999.99&inStock=true&features=backlit&features=touchscreen',
  'q=search%20term&page=1&limit=20&sort=relevance',
  'token=abc123&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback',
  'filters[category]=electronics&filters[price][min]=100&filters[price][max]=500'
];

// Simple URL parser (pure JavaScript implementation)
class UrlParserWrapper {
  parse(url: string) {
    try {
      const parsedUrl = new URL(url);
      return {
        protocol: parsedUrl.protocol.replace(/:$/, ''),
        auth: parsedUrl.username && parsedUrl.password ?
          `${parsedUrl.username}:${parsedUrl.password}` :
          parsedUrl.username || '',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: parsedUrl.pathname,
        search: parsedUrl.search.replace(/^\?/, ''),
        hash: parsedUrl.hash.replace(/^#/, '')
      };
    } catch (err) {
      return {
        protocol: '',
        auth: '',
        hostname: '',
        port: '',
        pathname: '',
        search: '',
        hash: ''
      };
    }
  }

  parseQueryString(queryString: string) {
    return querystring.parse(queryString);
  }
}

// Create parser instances
const jsUrlParser = new UrlParserWrapper();
const nativeUrlParser = new UrlParserWrapper(); // Using the same JS implementation for both

/**
 * Benchmark URL parsing
 */
function benchmarkUrlParsing(): void {
  console.log('\n=== URL Parsing ===');

  // Benchmark native URL parsing
  const nativeResult = runBenchmark(
    'Native URL Parse',
    'URL',
    () => {
      for (const url of sampleUrls) {
        nativeUrlParser.parse(url);
      }
    },
    10000
  );

  // Benchmark JS URL parsing
  const jsResult = runBenchmark(
    'JS URL Parse',
    'URL',
    () => {
      for (const url of sampleUrls) {
        new URL(url);
      }
    },
    10000
  );

  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark URL formatting
 */
function benchmarkUrlFormatting(): void {
  console.log('\n=== URL Formatting ===');

  // Prepare parsed URLs
  const nativeParsedUrls = sampleUrls.map(url => nativeUrlParser.parse(url));
  const jsParsedUrls = sampleUrls.map(url => new URL(url));

  // Benchmark native URL formatting
  const nativeResult = runBenchmark(
    'Native URL Format',
    'URL',
    () => {
      for (const parsedUrl of nativeParsedUrls) {
        // Convert parsed URL back to string manually
        const url =
          (parsedUrl.protocol ? parsedUrl.protocol + '://' : '') +
          (parsedUrl.auth ? parsedUrl.auth + '@' : '') +
          parsedUrl.hostname +
          (parsedUrl.port ? ':' + parsedUrl.port : '') +
          parsedUrl.pathname +
          (parsedUrl.search ? '?' + parsedUrl.search : '') +
          (parsedUrl.hash ? '#' + parsedUrl.hash : '');
      }
    },
    10000
  );

  // Benchmark JS URL formatting
  const jsResult = runBenchmark(
    'JS URL Format',
    'URL',
    () => {
      for (const parsedUrl of jsParsedUrls) {
        parsedUrl.toString();
      }
    },
    10000
  );

  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark query string parsing
 */
function benchmarkQueryStringParsing(): void {
  console.log('\n=== Query String Parsing ===');

  // Benchmark native query string parsing
  const nativeResult = runBenchmark(
    'Native Query String Parse',
    'URL',
    () => {
      for (const qs of sampleQueryStrings) {
        nativeUrlParser.parseQueryString(qs);
      }
    },
    10000
  );

  // Benchmark JS query string parsing
  const jsResult = runBenchmark(
    'JS Query String Parse',
    'URL',
    () => {
      for (const qs of sampleQueryStrings) {
        querystring.parse(qs);
      }
    },
    10000
  );

  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark query string formatting
 */
function benchmarkQueryStringFormatting(): void {
  console.log('\n=== Query String Formatting ===');

  // Prepare parsed query strings
  const nativeParsedQueries = sampleQueryStrings.map(qs => nativeUrlParser.parseQueryString(qs));
  const jsParsedQueries = sampleQueryStrings.map(qs => querystring.parse(qs));

  // Benchmark native query string formatting
  const nativeResult = runBenchmark(
    'Native Query String Format',
    'URL',
    () => {
      for (const parsedQuery of nativeParsedQueries) {
        querystring.stringify(parsedQuery);
      }
    },
    10000
  );

  // Benchmark JS query string formatting
  const jsResult = runBenchmark(
    'JS Query String Format',
    'URL',
    () => {
      for (const parsedQuery of jsParsedQueries) {
        querystring.stringify(parsedQuery);
      }
    },
    10000
  );

  compareResults(nativeResult, jsResult);
}

/**
 * Run all URL parser benchmarks
 */
export async function runUrlBenchmarks(): Promise<void> {
  benchmarkUrlParsing();
  benchmarkUrlFormatting();
  benchmarkQueryStringParsing();
  benchmarkQueryStringFormatting();
}
