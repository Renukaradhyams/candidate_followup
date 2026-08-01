const fs = require('fs');
const { execSync } = require('child_process');

console.log('[Build] Starting client build...');
execSync('cd client && npm install --legacy-peer-deps && npm run build', {stdio: 'inherit'});

const src = fs.existsSync('client/out') ? 'client/out' : 'client/.next';
if (fs.existsSync(src)) {
    // Always force-overwrite the dist folder to ensure UI updates are deployed
    if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true, force: true });
    }
    fs.cpSync(src, 'dist', { recursive: true });
    console.log('[Build] Copied client build to dist/');
} else {
    console.warn('[Build] Warning: Client build directory not found at:', src);
}

console.log('[Build] Build complete.');
