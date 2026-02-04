# clickAt

A simple, set-and-forget browser extension that schedules clicks on web elements or specific coordinates at a specified time.

## Installation

1. Clone this repository or download the source code.
2. Run the build script:
   ```bash
   python3 ./build.py release
   ```
3. Load the extension in your browser:
    - Chrome/Edge: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", select the `dist/chrome` directory.
    - Firefox: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select `manifest.json` inside the `dist/firefox` directory.

## Usage
1. *Right-click* any element on a webpage;
2. Select *"Click at..."* from the context menu;
3. Choose your preferred click mode (either `Web element` or `Exact coordinates`);
4. Set the desired time;
5. Click *"Confirm"*.

The element or coordinates you picked will automatically be clicked at the specified time.
