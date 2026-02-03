.PHONY: build clean release help

BUILD_SCRIPT = build.js
DIST_DIR = dist
CHROME_DIR = $(DIST_DIR)/chrome
FIREFOX_DIR = $(DIST_DIR)/firefox
CHROME_ZIP = $(DIST_DIR)/chrome-release.zip
FIREFOX_ZIP = $(DIST_DIR)/firefox-release.zip
MANIFEST_FILE = manifest.json
EXTENSION_FILES = content.js background.js style.css

release: build
	@echo "Creating Chrome release package..."
	@zip -9 -r $(CHROME_ZIP) $(CHROME_DIR)/*
	@echo "Created $(CHROME_ZIP) from $(CHROME_DIR)/"
	
	@echo "Creating Firefox release package..."
	@zip -9 -r $(FIREFOX_ZIP) $(FIREFOX_DIR)/*
	
	# Verify zip files were created
	@echo ""
	@echo "Release packages created:"
	@if [ -f "$(CHROME_ZIP)" ]; then \
		chrome_size=$$(du -h $(CHROME_ZIP) | cut -f1); \
		echo "$(CHROME_ZIP) ($$chrome_size) - Chrome extension"; \
	else \
		echo "ERROR: $(CHROME_ZIP) was not created"; \
	fi
	@if [ -f "$(FIREFOX_ZIP)" ]; then \
		firefox_size=$$(du -h $(FIREFOX_ZIP) | cut -f1); \
		echo "$(FIREFOX_ZIP) ($$firefox_size) - Firefox add-on"; \
	else \
		echo "ERROR: $(FIREFOX_ZIP) was not created"; \
	fi
	@echo ""
	@echo "Release completed successfully!"

build:
	@echo "Building extension..."
	@node $(BUILD_SCRIPT)
	@echo "Build completed!"

clean:
	@echo "Cleaning up..."
	@if [ -d "$(DIST_DIR)" ]; then \
		rm -rf $(DIST_DIR); \
		echo "Removed $(DIST_DIR) directory"; \
	else \
		echo "$(DIST_DIR) directory does not exist"; \
	fi
	@echo "Cleanup completed!"

all: build
dist: build
package: release

help:
	@echo "Available targets:"
	@echo "  build    - Build the extension"
	@echo "  clean    - Remove the dist directory"
	@echo "  release  - Build and create release zip files for Chrome and Firefox"
	@echo "  help     - Show this help message"
