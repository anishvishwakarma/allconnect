/**
 * Start dev server - frees port 4000 first to avoid EADDRINUSE
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { execSync, spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 4000;

// Free port using kill-port (cross-platform)
try {
  execSync(`npx --yes kill-port ${PORT}`, { stdio: 'ignore' });
} catch (_) {
  // Port may already be free
}

spawn('node', ['--watch', path.join(__dirname, '..', 'index.js')], {
  stdio: 'inherit',
  env: process.env,
  cwd: path.join(__dirname, '..'),
});
