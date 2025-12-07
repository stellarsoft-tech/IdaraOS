#!/usr/bin/env node

/**
 * Simple JavaScript runner for the generators
 * This avoids TypeScript module resolution issues
 */

const { spawnSync } = require('child_process');
const path = require('path');

const specPath = process.argv[2];

if (!specPath) {
  console.error('Usage: node run.js <spec-path>');
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), '..', specPath);

try {
  console.log(`Generating from: ${fullPath}`);
  
  // Use spawnSync with argument array to prevent command injection
  // Arguments are passed directly without shell interpretation
  const result = spawnSync('npx', ['tsx', path.join(__dirname, 'index.ts'), fullPath], {
    stdio: 'inherit',
    cwd: __dirname,
    shell: false // Explicitly disable shell to prevent injection
  });
  
  if (result.error) {
    throw result.error;
  }
  
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
} catch (error) {
  console.error('Generation failed:', error.message);
  process.exit(1);
}

