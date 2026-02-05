// Global state
let clickContext = null;
let scheduledClicks = []; // Array of {id, element, x, y, time, mode, timerId}
let isPickerActive = false;
let pickerOverlay = null;
let pickerHighlight = null;

// Listen for context menu
document.addEventListener("contextmenu", (event) => {
  clickContext = {
    element: event.target,
    x: event.clientX,
    y: event.clientY,
    timestamp: Date.now()
  };
}, true);

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openModal") {
    showModal();
  } else if (request.action === "toggleUI") {
    toggleMainUI();
  } else if (request.action === "startPicker") {
    startElementPicker();
  }
});

// ========== MAIN UI ==========
function toggleMainUI() {
  const existingUI = document.getElementById("clickat-main-ui");
  if (existingUI) {
    existingUI.remove();
    return;
  }
  showMainUI();
}

function showMainUI() {
  const existingUI = document.getElementById("clickat-main-ui");
  if (existingUI) existingUI.remove();

  const ui = document.createElement("div");
  ui.id = "clickat-main-ui";
  ui.innerHTML = `
    <div class="clickat-main-panel">
      <div class="clickat-main-header">
        <h3>📍 clickAt</h3>
        <button id="clickat-main-close" class="clickat-icon-btn">✕</button>
      </div>
      
      <div class="clickat-main-actions">
        <button id="clickat-add-click" class="clickat-primary-btn">
          Schedule new click
        </button>
      </div>
      
      <div class="clickat-scheduled-list" id="clickat-scheduled-list">
        ${renderScheduledClicks()}
      </div>
    </div>
  `;
  
  document.body.appendChild(ui);
  
  // Event listeners
  document.getElementById("clickat-main-close").addEventListener("click", () => ui.remove());
  document.getElementById("clickat-add-click").addEventListener("click", () => {
    ui.remove();
    startElementPicker();
  });
  
  // Add delete listeners
  ui.querySelectorAll(".clickat-delete-scheduled").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.target.closest(".clickat-delete-scheduled").dataset.id);
      deleteScheduledClick(id);
      updateScheduledList();
    });
  });
}

function renderScheduledClicks() {
  if (scheduledClicks.length === 0) {
    return `
      <div class="clickat-empty-state">
        <span class="clickat-empty-icon">⏰</span>
        <p>No scheduled clicks yet</p>
      </div>
    `;
  }
  
  return scheduledClicks.map(click => {
    const now = new Date();
    const targetTime = new Date(click.time);
    const diff = targetTime - now;
    const minutesLeft = Math.ceil(diff / 1000 / 60);
    
    const timeStr = targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isToday = targetTime.toDateString() === now.toDateString();
    const dayStr = isToday ? "Today" : "Tomorrow";
    
    const modeIcon = click.mode === "coordinates" ? "📍" : "🎯";
    const modeText = click.mode === "coordinates" ? "Coordinates" : "Element";
    
    return `
      <div class="clickat-scheduled-item">
        <div class="clickat-scheduled-info">
          <div class="clickat-scheduled-time">
            <span class="clickat-time-badge">${timeStr}</span>
            <span class="clickat-day-badge">${dayStr}</span>
          </div>
          <div class="clickat-scheduled-details">
            <span class="clickat-mode-badge">${modeIcon} ${modeText}</span>
            ${click.mode === "element" ? 
              `<span class="clickat-element-tag">${click.element?.tagName?.toLowerCase() || 'N/A'}</span>` :
              `<span class="clickat-coords-text">X: ${click.x}, Y: ${click.y}</span>`
            }
          </div>
          <div class="clickat-countdown">⏱️ ${minutesLeft} min left</div>
        </div>
        <button class="clickat-delete-scheduled" data-id="${click.id}">🗑️</button>
      </div>
    `;
  }).join('');
}

function updateScheduledList() {
  const list = document.getElementById("clickat-scheduled-list");
  if (list) {
    list.innerHTML = renderScheduledClicks();
    
    // Re-attach delete listeners
    list.querySelectorAll(".clickat-delete-scheduled").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = parseInt(e.target.closest(".clickat-delete-scheduled").dataset.id);
        deleteScheduledClick(id);
        updateScheduledList();
      });
    });
  }
}

function deleteScheduledClick(id) {
  const index = scheduledClicks.findIndex(c => c.id === id);
  if (index !== -1) {
    const click = scheduledClicks[index];
    if (click.timerId) {
      clearTimeout(click.timerId);
    }
    scheduledClicks.splice(index, 1);
  }
}

// ========== ELEMENT PICKER ==========
function startElementPicker() {
  if (isPickerActive) return;
  
  isPickerActive = true;
  document.body.style.cursor = "crosshair";
  
  // Create overlay
  pickerOverlay = document.createElement("div");
  pickerOverlay.id = "clickat-picker-overlay";
  pickerOverlay.innerHTML = `
    <div class="clickat-picker-toolbar">
      <span class="clickat-picker-title">🎯 Click to select an element</span>
      <button id="clickat-picker-cancel" class="clickat-picker-btn">Cancel (ESC)</button>
    </div>
  `;
  document.body.appendChild(pickerOverlay);
  
  // Create highlight box
  pickerHighlight = document.createElement("div");
  pickerHighlight.id = "clickat-picker-highlight";
  document.body.appendChild(pickerHighlight);
  
  // Event listeners
  document.addEventListener("mousemove", handlePickerMouseMove);
  document.addEventListener("click", handlePickerClick, true);
  document.addEventListener("keydown", handlePickerKeydown);
  
  document.getElementById("clickat-picker-cancel").addEventListener("click", cancelPicker);
}

function handlePickerMouseMove(e) {
  if (!isPickerActive) return;
  
  const element = document.elementFromPoint(e.clientX, e.clientY);
  if (!element || element.id === "clickat-picker-highlight" || element.closest("#clickat-picker-overlay")) {
    pickerHighlight.style.display = "none";
    return;
  }
  
  const rect = element.getBoundingClientRect();
  pickerHighlight.style.display = "block";
  pickerHighlight.style.left = rect.left + window.scrollX + "px";
  pickerHighlight.style.top = rect.top + window.scrollY + "px";
  pickerHighlight.style.width = rect.width + "px";
  pickerHighlight.style.height = rect.height + "px";
}

function handlePickerClick(e) {
  if (!isPickerActive) return;
  
  const target = document.elementFromPoint(e.clientX, e.clientY);
  
  // Ignore clicks on picker UI
  if (target.closest("#clickat-picker-overlay") || target.id === "clickat-picker-highlight") {
    return;
  }
  
  e.preventDefault();
  e.stopPropagation();
  
  // Store the selected element
  clickContext = {
    element: target,
    x: e.clientX,
    y: e.clientY,
    timestamp: Date.now()
  };
  
  cancelPicker();
  showModal();
}

function handlePickerKeydown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    cancelPicker();
  }
}

function cancelPicker() {
  isPickerActive = false;
  document.body.style.cursor = "";
  
  document.removeEventListener("mousemove", handlePickerMouseMove);
  document.removeEventListener("click", handlePickerClick, true);
  document.removeEventListener("keydown", handlePickerKeydown);
  
  if (pickerOverlay) pickerOverlay.remove();
  if (pickerHighlight) pickerHighlight.remove();
  pickerOverlay = null;
  pickerHighlight = null;
}

// ========== SCHEDULE MODAL ==========
function showModal() {
  if (!clickContext) {
    showError("No target selected", "Please use the element picker to select a target first.");
    return;
  }

  const existingModal = document.getElementById("clickat-extension-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "clickat-extension-modal";
  
  modal.innerHTML = `
    <div class="clickat-modal-content">
      <h3>⏰ Schedule Click</h3>
      <p>When should it be clicked?</p>
      <input type="time" id="clickat-time-input" required step="1">
      
      <div class="clickat-quick-time">
        <button class="clickat-quick-btn" data-minutes="5">+5m</button>
        <button class="clickat-quick-btn" data-minutes="30">+30m</button>
        <button class="clickat-quick-btn" data-minutes="60">+1h</button>
        <button class="clickat-quick-btn" data-minutes="300">+5h</button>
      </div>
      
      <div class="clickat-mode-selector">
        <label class="clickat-mode-label">Click mode:</label>
        <div class="clickat-mode-options">
          <label class="clickat-mode-option">
            <input type="radio" name="click-mode" value="element" checked>
            <span class="clickat-mode-icon">🎯</span>
            <span class="clickat-mode-text">Element</span>
          </label>
          <label class="clickat-mode-option">
            <input type="radio" name="click-mode" value="coordinates">
            <span class="clickat-mode-icon">📍</span>
            <span class="clickat-mode-text">Coordinates</span>
          </label>
        </div>
      </div>
      
      <div class="clickat-mode-info" id="clickat-mode-info">
        <div class="clickat-mode-info-element">
          <strong>Element:</strong> <span class="clickat-element-preview">${clickContext?.element?.tagName?.toLowerCase() || 'N/A'}</span>
        </div>
        <div class="clickat-mode-info-coordinates" style="display: none;">
          <strong>Coordinates:</strong> <span class="clickat-coordinates-preview">X: ${clickContext?.x || 0}, Y: ${clickContext?.y || 0}</span>
        </div>
      </div>
      
      <div class="clickat-buttons">
        <button id="clickat-cancel">Cancel</button>
        <button id="clickat-confirm">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Set default time to current time + 1 minute
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  now.setSeconds(0);
  const timeString = now.toTimeString().split(' ')[0].substring(0, 5);
  const input = document.getElementById("clickat-time-input");
  input.value = timeString;
  input.focus();

  // Quick time buttons
  modal.querySelectorAll('.clickat-quick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const minutes = parseInt(btn.dataset.minutes);
      const newTime = new Date();
      newTime.setMinutes(newTime.getMinutes() + minutes);
      newTime.setSeconds(0);
      const newTimeString = newTime.toTimeString().split(' ')[0].substring(0, 5);
      input.value = newTimeString;
    });
  });

  // Setup mode radio buttons
  const modeRadios = modal.querySelectorAll('input[name="click-mode"]');
  const elementInfo = modal.querySelector(".clickat-mode-info-element");
  const coordinatesInfo = modal.querySelector(".clickat-mode-info-coordinates");
  
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

  document.getElementById("clickat-cancel").addEventListener("click", () => modal.remove());
  document.getElementById("clickat-confirm").addEventListener("click", () => scheduleClick(modal));
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

function scheduleClick(modal) {
  const timeInput = document.getElementById("clickat-time-input").value;
  if (!timeInput) return;

  const selectedMode = modal.querySelector('input[name="click-mode"]:checked').value;

  // Calculate target time
  const now = new Date();
  const [hours, minutes] = timeInput.split(":").map(Number);
  
  let targetTime = new Date();
  targetTime.setHours(hours, minutes, 0, 0);

  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  const delay = targetTime - now;
  const minutesLeft = Math.ceil(delay / 1000 / 60);

  // Create scheduled click object
  const clickId = Date.now();
  const scheduledClick = {
    id: clickId,
    element: clickContext?.element,
    x: clickContext?.x || 0,
    y: clickContext?.y || 0,
    time: targetTime.getTime(),
    mode: selectedMode,
    timerId: null
  };

  // Set timer
  scheduledClick.timerId = setTimeout(() => {
    performClick(scheduledClick.mode, scheduledClick);
    deleteScheduledClick(clickId);
  }, delay);

  scheduledClicks.push(scheduledClick);

  showConfirmation(modal, targetTime, minutesLeft, targetTime.toDateString() !== now.toDateString(), selectedMode);
}

function showConfirmation(modal, targetTime, minutesLeft, isTomorrow, clickMode) {
  const contentDiv = modal.querySelector(".clickat-modal-content");
  
  const timeStr = targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = isTomorrow ? "tomorrow" : "today";
  const modeStr = clickMode === "coordinates" ? "at exact coordinates" : "on the web element";

  contentDiv.innerHTML = `
    <span class="clickat-success-icon">✓</span>
    <h3>✅ Scheduled!</h3>
    <p>The click will be performed ${dayStr} at <span class="clickat-highlight">${timeStr}</span> ${modeStr}.</p>
    <p style="font-size: 0.9em; opacity: 0.8;">⏱️ About ${minutesLeft} minutes left</p>
    <div class="clickat-buttons">
      <button id="clickat-close-success">Close</button>
    </div>
  `;

  document.getElementById("clickat-close-success").addEventListener("click", () => modal.remove());
}

function showError(title, message) {
  const errorModal = document.createElement("div");
  errorModal.id = "clickat-extension-error-modal";
  errorModal.innerHTML = `
    <div class="clickat-modal-content">
      <h3 style="color: var(--clickat-error-color);">⚠️ ${title}</h3>
      <p>${message}</p>
      <div class="clickat-buttons">
        <button id="clickat-error-close">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(errorModal);
  
  document.getElementById("clickat-error-close").addEventListener("click", () => errorModal.remove());
  errorModal.addEventListener("click", (e) => {
    if (e.target === errorModal) errorModal.remove();
  });
}

// ========== CLICK EXECUTION ==========
function performClick(mode, context) {
  if (!context || (!context.element && mode === "element")) {
    console.error("No valid click context available for mode:", mode);
    return;
  }

  if (mode === "element" && context.element) {
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
    const elementAtPoint = document.elementFromPoint(context.x, context.y);
    
    if (elementAtPoint) {
      const originalOutline = elementAtPoint.style.outline;
      const originalTransition = elementAtPoint.style.transition;
      
      elementAtPoint.style.transition = "all 0.2s";
      elementAtPoint.style.outline = "4px solid #2196F3";
      elementAtPoint.scrollIntoView({ behavior: "smooth", block: "center" });

      const clickIndicator = document.createElement("div");
      clickIndicator.style.cssText = `
        position: fixed;
        left: ${context.x - 10}px;
        top: ${context.y - 10}px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: rgba(33, 150, 243, 0.7);
        border: 2px solid white;
        box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.5);
        z-index: 2147483646;
        pointer-events: none;
      `;
      document.body.appendChild(clickIndicator);

      setTimeout(() => {
        const mouseEvent = new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: context.x,
          clientY: context.y
        });
        
        elementAtPoint.dispatchEvent(mouseEvent);
        elementAtPoint.style.outline = originalOutline;
        elementAtPoint.style.transition = originalTransition;
        setTimeout(() => clickIndicator.remove(), 500);
      }, 300);
    }
  }
}

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
  scheduledClicks.forEach(click => {
    if (click.timerId) {
      clearTimeout(click.timerId);
    }
  });
});
