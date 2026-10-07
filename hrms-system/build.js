const fs = require('fs');
const { execSync } = require('child_process');

console.log('[Build] Starting client build...');
execSync('cd client && npm install --legacy-peer-deps && npm run build', {stdio: 'inherit'});

const path = require('path');
const src = path.join(__dirname, 'client', 'dist');
const dist = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'client', 'public');

if (fs.existsSync(src)) {
    if (fs.existsSync(dist)) {
        fs.rmSync(dist, { recursive: true, force: true });
    }
    fs.cpSync(src, dist, { recursive: true });

    if (fs.existsSync(publicDir)) {
        const files = fs.readdirSync(publicDir);
        files.forEach(file => {
            const pubPath = path.join(publicDir, file);
            fs.copyFileSync(pubPath, path.join(dist, file));
            fs.copyFileSync(pubPath, path.join(src, file));
        });
        console.log('[Build] Copied PWA public assets to dist/ & client/dist/');
    }
    console.log('[Build] Copied client build to dist/');

    // Sync to root dist, root assets, and root static files for direct web server access
    try {
        const rootDist = path.join(__dirname, '..', 'dist');
        const rootIndex = path.join(__dirname, '..', 'index.html');
        const rootAssets = path.join(__dirname, '..', 'assets');
        if (fs.existsSync(rootDist)) {
            fs.rmSync(rootDist, { recursive: true, force: true });
        }
        fs.cpSync(dist, rootDist, { recursive: true });

        // Ensure root /assets directory exists and has all compiled chunks
        if (fs.existsSync(path.join(dist, 'assets'))) {
            if (fs.existsSync(rootAssets)) {
                fs.rmSync(rootAssets, { recursive: true, force: true });
            }
            fs.cpSync(path.join(dist, 'assets'), rootAssets, { recursive: true });

            // Also copy chunks to dist root so both /assets/file.js and /file.js resolve without 404
            const assetFiles = fs.readdirSync(path.join(dist, 'assets'));
            assetFiles.forEach(file => {
                const srcPath = path.join(dist, 'assets', file);
                if (fs.statSync(srcPath).isFile()) {
                    fs.copyFileSync(srcPath, path.join(dist, file));
                    fs.copyFileSync(srcPath, path.join(rootDist, file));
                }
            });
            console.log('[Build] Synced assets to root /assets and root dist/');
        }

        // Copy root files (index.html, manifest, icons, sw.js) to root directory
        const distFiles = fs.readdirSync(dist);
        distFiles.forEach(file => {
            const srcPath = path.join(dist, file);
            if (fs.statSync(srcPath).isFile()) {
                fs.copyFileSync(srcPath, path.join(__dirname, '..', file));
            }
        });

        // Generate aliases for browsers that request them
        const manifestSrc = path.join(dist, 'manifest.json');
        if (fs.existsSync(manifestSrc)) {
            fs.copyFileSync(manifestSrc, path.join(__dirname, '..', 'site.webmanifest'));
            fs.copyFileSync(manifestSrc, path.join(dist, 'site.webmanifest'));
        }
        const faviconSrc = path.join(dist, 'favicon-32x32.png');
        if (fs.existsSync(faviconSrc)) {
            ['favicon-16x16.png', 'favicon.png'].forEach(alias => {
                fs.copyFileSync(faviconSrc, path.join(__dirname, '..', alias));
                fs.copyFileSync(faviconSrc, path.join(dist, alias));
            });
        }
        const appleIconSrc = path.join(dist, 'apple-touch-icon.png');
        if (fs.existsSync(appleIconSrc)) {
            fs.copyFileSync(appleIconSrc, path.join(__dirname, '..', 'apple-touch-icon-precomposed.png'));
            fs.copyFileSync(appleIconSrc, path.join(dist, 'apple-touch-icon-precomposed.png'));
        }

        console.log('[Build] Synced build to root dist/, root assets/, and root index.html');
    } catch (e) {
        console.warn('[Build] Note: Root dist sync:', e.message);
    }
} else {
    console.warn('[Build] Warning: Client build directory not found at:', src);
}

console.log('[Build] Build complete.');
