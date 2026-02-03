const fs = require('fs');
const path = require('path');

const EXTENSION_ID = "@clickAt"

const ASSETS_DIR = path.join(__dirname, 'assets')
const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
const CHROME_DIR = path.join(DIST_DIR, 'chrome');
const FIREFOX_DIR = path.join(DIST_DIR, 'firefox');

const MANIFEST_SRC = 'manifest.json';
const BACKGROUND_SRC = 'background.js';
const CONTENT_SRC = 'content.js';
const STYLES_SRC = 'style.css';
const ICON_ASSET = 'icon.png';

const filesToCopy = [
    path.join(SRC_DIR, BACKGROUND_SRC),
    path.join(SRC_DIR, CONTENT_SRC),
    path.join(SRC_DIR, STYLES_SRC),

    path.join(ASSETS_DIR, ICON_ASSET),
];

function log(level, event, data = {}) {
  console[level](JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...data
  }));
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        log("info", "Created directory", {dirPath});
    }
}

function copyFile(filename, destDir) {
    const destPath = path.join(destDir, path.basename(filename));

    if (fs.existsSync(filename)) {
        fs.copyFileSync(filename, destPath);
    } else {
        log("warn", "Filename does not exist so it was not copied", {filename});
    }
}

log("info", "Build started")

ensureDir(DIST_DIR);
ensureDir(CHROME_DIR);
ensureDir(FIREFOX_DIR);

const manifestPath = path.join(SRC_DIR, MANIFEST_SRC);
if (!fs.existsSync(manifestPath)) {
    log("error", "Manifest not found", {manifestPath})
    process.exit(1);
}
const baseManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const chromeManifest = JSON.parse(JSON.stringify(baseManifest));
chromeManifest.background = {
    "service_worker": BACKGROUND_SRC
};
fs.writeFileSync(
    path.join(CHROME_DIR, 'manifest.json'), 
    JSON.stringify(chromeManifest, null, 2)
);

const firefoxManifest = JSON.parse(JSON.stringify(baseManifest));
firefoxManifest.background = {
    "scripts": [BACKGROUND_SRC]
};
firefoxManifest.browser_specific_settings = {
    gecko: {
        id: EXTENSION_ID,
        data_collection_permissions: {
              required: ["none"],
        }
    }
};

fs.writeFileSync(
    path.join(FIREFOX_DIR, 'manifest.json'), 
    JSON.stringify(firefoxManifest, null, 2)
);

filesToCopy.forEach(file => {
    copyFile(file, CHROME_DIR);
    copyFile(file, FIREFOX_DIR);
});

log("info", "Build completed", {CHROME_DIR, FIREFOX_DIR})
