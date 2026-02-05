#!/usr/bin/env python3
import json
import os
import shutil
import sys
import zipfile
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

EXTENSION_ID = "@clickAt"
ASSETS_DIR = os.path.join(os.path.dirname(__file__), 'assets')
SRC_DIR = os.path.join(os.path.dirname(__file__), 'src')
DIST_DIR = os.path.join(os.path.dirname(__file__), 'dist')
CHROME_DIR = os.path.join(DIST_DIR, 'chrome')
FIREFOX_DIR = os.path.join(DIST_DIR, 'firefox')

MANIFEST_SRC = 'manifest.json'
BACKGROUND_SRC = 'background.js'
CONTENT_SRC = 'content.js'
STYLES_SRC = 'style.css'
ICON_ASSET = 'icon.png'

files_to_copy = [
    os.path.join(SRC_DIR, BACKGROUND_SRC),
    os.path.join(SRC_DIR, CONTENT_SRC),
    os.path.join(SRC_DIR, STYLES_SRC),
    os.path.join(ASSETS_DIR, ICON_ASSET),
]

def ensure_dir(dir_path):
    """Create directory if it doesn't exist."""
    if not os.path.exists(dir_path):
        os.makedirs(dir_path, exist_ok=True)
        logger.info(f"Created directory: {dir_path}")

def copy_file(filename, dest_dir):
    """Copy a file to destination directory."""
    if os.path.exists(filename):
        dest_path = os.path.join(dest_dir, os.path.basename(filename))
        shutil.copy2(filename, dest_path)
    else:
        logger.warning(f"File does not exist, skipping: {filename}")

def create_zip(source_dir, output_zip):
    """Create a zip archive from a directory."""
    try:
        with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, source_dir)
                    zipf.write(file_path, arcname)
        
        zip_size = os.path.getsize(output_zip)
        logger.info(f"Created {output_zip} ({zip_size} bytes)")
        return True
    except Exception as e:
        logger.error(f"Failed to create zip {output_zip}: {e}")
        return False

def build():
    """Build the extension for Chrome and Firefox."""
    logger.info("Build started")
    
    # Create directories
    ensure_dir(DIST_DIR)
    ensure_dir(CHROME_DIR)
    ensure_dir(FIREFOX_DIR)
    
    # Load and process manifest
    manifest_path = os.path.join(SRC_DIR, MANIFEST_SRC)
    if not os.path.exists(manifest_path):
        logger.error(f"Manifest not found: {manifest_path}")
        sys.exit(1)
    
    with open(manifest_path, 'r', encoding='utf-8') as f:
        base_manifest = json.load(f)
    
    # Chrome manifest
    chrome_manifest = json.loads(json.dumps(base_manifest))
    chrome_manifest['background'] = {
        "service_worker": BACKGROUND_SRC
    }
    
    chrome_manifest_path = os.path.join(CHROME_DIR, 'manifest.json')
    with open(chrome_manifest_path, 'w', encoding='utf-8') as f:
        json.dump(chrome_manifest, f, indent=2)
    
    # Firefox manifest
    firefox_manifest = json.loads(json.dumps(base_manifest))
    firefox_manifest['background'] = {
        "scripts": [BACKGROUND_SRC]
    }
    firefox_manifest['browser_specific_settings'] = {
        "gecko": {
            "id": EXTENSION_ID,
            "data_collection_permissions": {
                "required": ["none"]
            }
        }
    }
    
    firefox_manifest_path = os.path.join(FIREFOX_DIR, 'manifest.json')
    with open(firefox_manifest_path, 'w', encoding='utf-8') as f:
        json.dump(firefox_manifest, f, indent=2)
    
    # Copy files
    for file in files_to_copy:
        copy_file(file, CHROME_DIR)
        copy_file(file, FIREFOX_DIR)
    
    logger.info(f"Build completed: {CHROME_DIR}, {FIREFOX_DIR}")
    return True

def package():
    """Create release packages (zip files)."""
    logger.info("Creating release packages...")
    
    chrome_zip = os.path.join(DIST_DIR, 'chrome-release.zip')
    firefox_zip = os.path.join(DIST_DIR, 'firefox-release.zip')
    
    # Create zip files
    chrome_success = create_zip(CHROME_DIR, chrome_zip)
    firefox_success = create_zip(FIREFOX_DIR, firefox_zip)
    
    # Report results
    logger.info("\nRelease packages created:")
    if os.path.exists(chrome_zip):
        size = os.path.getsize(chrome_zip)
        logger.info(f"  {chrome_zip} ({size} bytes) - Chrome extension")
    
    if os.path.exists(firefox_zip):
        size = os.path.getsize(firefox_zip)
        logger.info(f"  {firefox_zip} ({size} bytes) - Firefox add-on")
    
    if chrome_success and firefox_success:
        logger.info("Release completed successfully!")
        return True
    else:
        logger.error("Release completed with errors")
        return False

def clean() -> bool:
    """Clean up the dist directory."""
    logger.info("Cleaning up...")
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
        logger.info(f"Removed {DIST_DIR} directory")
    else:
        logger.info(f"{DIST_DIR} directory does not exist")
    logger.info("Cleanup completed!")
    return True

def main() -> int:
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Build and package browser extension')
    parser.add_argument('action', choices=['build', 'clean', 'release', 'all'], help='Action to perform')
    
    args = parser.parse_args()

    match args.action:
        case 'build':
            if build():
                return 0
        case 'clean':
            if clean():
                return 0
        case 'release':
            if build():
                if package():
                    return 0
        case 'all':
            if clean():
                if build():
                    if package():
                        return 0
    
    return 1

if __name__ == '__main__':
    sys.exit(main())
