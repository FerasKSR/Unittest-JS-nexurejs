#!/bin/bash

# Script to run TypeScript files directly using ts-node with ESM support
# Usage: ./run-ts.sh path/to/file.ts

if [ -z "$1" ]; then
  echo "Please provide a TypeScript file to run"
  echo "Usage: ./run-ts.sh path/to/file.ts"
  exit 1
fi

# Run the TypeScript file with proper configuration
TS_NODE_ESM=true node --loader ts-node/register --experimental-specifier-resolution=node "$1"
