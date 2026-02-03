let clickContext = null;
let clickTimerId = null;

document.addEventListener("contextmenu", (event) => {
  // Store the complete click context
  clickContext = {
    element: event.target,
    x: event.clientX,
    y: event.clientY,
    timestamp: Date.now()
  };
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openModal") {
    showModal();
  }
});

function showModal() {
  // Check if clickContext exists
  if (!clickContext) {
    // Show an error message in a minimal modal
    const errorModal = document.createElement("div");
    errorModal.id = "ct-extension-error-modal";
    errorModal.innerHTML = `
      <div class="ct-modal-content">
        <h3 style="color: #f44336;">⚠️ No Target Selected</h3>
        <p>Please right-click on an element first to select a target.</p>
        <div class="ct-buttons">
          <button id="ct-error-close">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(errorModal);
    
    // Style the error modal
    errorModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      backdrop-filter: blur(2px);
    `;
    
    document.getElementById("ct-error-close").addEventListener("click", () => errorModal.remove());
    errorModal.addEventListener("click", (e) => {
      if (e.target === errorModal) errorModal.remove();
    });
    
    return; // Stop further execution
  }

  const existingModal = document.getElementById("ct-extension-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "ct-extension-modal";
  
  modal.innerHTML = `
    <div class="ct-modal-content">
      <h3>clickAt</h3>
      <p>What time should it be clicked?</p>
      <input type="time" id="ct-time-input" required step="1">
      
      <div class="ct-mode-selector">
        <div class="ct-mode-options">
          <label class="ct-mode-option">
            <input type="radio" name="click-mode" value="element" checked>
            <span class="ct-mode-text">Web Element</span>
          </label>
          <label class="ct-mode-option">
            <input type="radio" name="click-mode" value="coordinates">
            <span class="ct-mode-text">Exact Coordinates</span>
          </label>
        </div>
      </div>
      
      <div class="ct-mode-info" id="ct-mode-info">
        <div class="ct-mode-info-element">
          <strong>Element:</strong> <span class="ct-element-preview">${clickContext?.element?.tagName?.toLowerCase() || 'N/A'}</span>
        </div>
        <div class="ct-mode-info-coordinates" style="display: none;">
          <strong>Coordinates:</strong> <span class="ct-coordinates-preview">X: ${clickContext?.x || 0}, Y: ${clickContext?.y || 0}</span>
        </div>
      </div>
      
      <div class="ct-buttons">
        <button id="ct-cancel">Cancel</button>
        <button id="ct-confirm">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Set default time to current time + 1 minute
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  now.setSeconds(0);
  const timeString = now.toTimeString().split(' ')[0].substring(0, 5);
  const input = document.getElementById("ct-time-input");
  input.value = timeString;
  input.focus();

  // Setup mode radio buttons
  const modeRadios = modal.querySelectorAll('input[name="click-mode"]');
  const elementInfo = modal.querySelector(".ct-mode-info-element");
  const coordinatesInfo = modal.querySelector(".ct-mode-info-coordinates");
  
  modeRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const mode = e.target.value;
      if (mode === "coordinates") {
        elementInfo.style.display = "none";
        coordinatesInfo.style.display = "block";
      } else {
        elementInfo.style.display = "block";
        coordinatesInfo.style.display = "none";
      }
    });
  });

  document.getElementById("ct-cancel").addEventListener("click", () => modal.remove());
  document.getElementById("ct-confirm").addEventListener("click", () => setTimer(modal));
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

function setTimer(modal) {
  const timeInput = document.getElementById("ct-time-input").value;
  if (!timeInput) return;

  // Get selected mode
  const selectedMode = modal.querySelector('input[name="click-mode"]:checked').value;
  const clickMode = selectedMode;

  // Store current context for the timer to prevent changes
  const timerContext = {
    element: clickContext?.element,
    x: clickContext?.x || 0,
    y: clickContext?.y || 0
  };

  const now = new Date();
  const [hours, minutes] = timeInput.split(":").map(Number);
  
  let targetTime = new Date();
  targetTime.setHours(hours, minutes, 0, 0);

  let isTomorrow = false;
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
    isTomorrow = true;
  }

  const delay = targetTime - now;
  const minutesLeft = Math.ceil(delay / 1000 / 60);

  if (clickTimerId) clearTimeout(clickTimerId);

  clickTimerId = setTimeout(() => {
    performClick(clickMode, timerContext);
  }, delay);

  showConfirmation(modal, targetTime, minutesLeft, isTomorrow, clickMode);
}

function showConfirmation(modal, targetTime, minutesLeft, isTomorrow, clickMode) {
  const contentDiv = modal.querySelector(".ct-modal-content");
  
  const timeStr = targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = isTomorrow ? "tomorrow" : "today";
  const modeStr = clickMode === "coordinates" ? "at exact coordinates" : "on the web element";

  contentDiv.innerHTML = `
    <span class="ct-success-icon">✓</span>
    <h3>Done!</h3>
    <p>The click will be performed ${dayStr} at <span class="ct-highlight">${timeStr}</span> ${modeStr}.</p>
    <p style="font-size: 0.9em; opacity: 0.8;">(About ${minutesLeft} minutes left)</p>
    <div class="ct-buttons">
      <button id="ct-close-success">Close</button>
    </div>
  `;

  document.getElementById("ct-close-success").addEventListener("click", () => modal.remove());
}

function performClick(mode, context) {
  if (!context || (!context.element && mode === "element")) {
    console.error("No valid click context available for mode:", mode);
    return;
  }

  if (mode === "element" && context.element) {
    // Click on the stored element
    const element = context.element;
    const originalOutline = element.style.outline;
    const originalTransition = element.style.transition;
    
    element.style.transition = "all 0.2s";
    element.style.outline = "4px solid #4CAF50";
    element.scrollIntoView({ behavior: "smooth", block: "center" });

    setTimeout(() => {
      element.click();
      element.style.outline = originalOutline;
      element.style.transition = originalTransition;
    }, 300);
  } else if (mode === "coordinates") {
    // Click at exact coordinates
    const elementAtPoint = document.elementFromPoint(context.x, context.y);
    
    if (elementAtPoint) {
      // Highlight the element at coordinates
      const originalOutline = elementAtPoint.style.outline;
      const originalTransition = elementAtPoint.style.transition;
      
      elementAtPoint.style.transition = "all 0.2s";
      elementAtPoint.style.outline = "4px solid #2196F3";
      
      // Scroll to the element if possible
      elementAtPoint.scrollIntoView({ behavior: "smooth", block: "center" });

      // Create a visual indicator at the exact click point
      const clickIndicator = document.createElement("div");
      clickIndicator.style.position = "fixed";
      clickIndicator.style.left = `${context.x - 10}px`;
      clickIndicator.style.top = `${context.y - 10}px`;
      clickIndicator.style.width = "20px";
      clickIndicator.style.height = "20px";
      clickIndicator.style.borderRadius = "50%";
      clickIndicator.style.backgroundColor = "rgba(33, 150, 243, 0.7)";
      clickIndicator.style.border = "2px solid white";
      clickIndicator.style.boxShadow = "0 0 0 2px rgba(33, 150, 243, 0.5)";
      clickIndicator.style.zIndex = "2147483646";
      clickIndicator.style.pointerEvents = "none";
      document.body.appendChild(clickIndicator);

      setTimeout(() => {
        // Simulate a mouse event at the exact coordinates
        const mouseEvent = new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: context.x,
          clientY: context.y
        });
        
        elementAtPoint.dispatchEvent(mouseEvent);
        
        // Clean up
        elementAtPoint.style.outline = originalOutline;
        elementAtPoint.style.transition = originalTransition;
        setTimeout(() => clickIndicator.remove(), 500);
      }, 300);
    } else {
      console.error("No element found at the specified coordinates.");
    }
  } else {
    console.error("Invalid click mode or missing element.");
  }
}
