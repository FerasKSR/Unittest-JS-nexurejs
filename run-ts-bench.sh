#!/bin/bash

# Script to transpile and run TypeScript files
# Usage: ./run-ts-bench.sh path/to/file.ts

if [ -z "$1" ]; then
  echo "Please provide a TypeScript file to run"
  echo "Usage: ./run-ts-bench.sh path/to/file.ts"
  exit 1
fi

TS_FILE=$1
JS_FILE="${TS_FILE%.ts}.js"
TEMP_DIR="temp-js"

echo "Transpiling $TS_FILE to JavaScript..."
mkdir -p $TEMP_DIR

# Transpile the TypeScript file to JavaScript
npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 --esModuleInterop --outDir $TEMP_DIR $TS_FILE

if [ $? -ne 0 ]; then
  echo "Failed to transpile $TS_FILE"
  exit 1
fi

TEMP_JS_FILE="$TEMP_DIR/$JS_FILE"

echo "Running $TEMP_JS_FILE..."
node $TEMP_JS_FILE

# Clean up temporary files
rm -rf $TEMP_DIR
