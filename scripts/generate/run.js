#!/usr/bin/env node

/**
 * Simple JavaScript runner for the generators
 * This avoids TypeScript module resolution issues
 */

const { execSync } = require('child_process');
const path = require('path');

const specPath = process.argv[2];

if (!specPath) {
  console.error('Usage: node run.js <spec-path>');
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), '..', specPath);

try {
  console.log(`Generating from: ${fullPath}`);
  execSync(`npx tsx ${__dirname}/index.ts ${fullPath}`, {
    stdio: 'inherit',
    cwd: __dirname
  });
} catch (error) {
  console.error('Generation failed:', error.message);
  process.exit(1);
}

