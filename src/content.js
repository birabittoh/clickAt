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
  const existingUI = document.getElementById("ct-main-ui");
  if (existingUI) {
    existingUI.remove();
    return;
  }
  showMainUI();
}

function showMainUI() {
  const existingUI = document.getElementById("ct-main-ui");
  if (existingUI) existingUI.remove();

  const ui = document.createElement("div");
  ui.id = "ct-main-ui";
  ui.innerHTML = `
    <div class="ct-main-panel">
      <div class="ct-main-header">
        <h3>📍 clickAt</h3>
        <button id="ct-main-close" class="ct-icon-btn">✕</button>
      </div>
      
      <div class="ct-main-actions">
        <button id="ct-add-click" class="ct-primary-btn">
          Schedule new click
        </button>
      </div>
      
      <div class="ct-scheduled-list" id="ct-scheduled-list">
        ${renderScheduledClicks()}
      </div>
    </div>
  `;
  
  document.body.appendChild(ui);
  
  // Event listeners
  document.getElementById("ct-main-close").addEventListener("click", () => ui.remove());
  document.getElementById("ct-add-click").addEventListener("click", () => {
    ui.remove();
    startElementPicker();
  });
  
  // Add delete listeners
  ui.querySelectorAll(".ct-delete-scheduled").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.target.closest(".ct-delete-scheduled").dataset.id);
      deleteScheduledClick(id);
      updateScheduledList();
    });
  });
}

function renderScheduledClicks() {
  if (scheduledClicks.length === 0) {
    return `
      <div class="ct-empty-state">
        <span class="ct-empty-icon">⏰</span>
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
      <div class="ct-scheduled-item">
        <div class="ct-scheduled-info">
          <div class="ct-scheduled-time">
            <span class="ct-time-badge">${timeStr}</span>
            <span class="ct-day-badge">${dayStr}</span>
          </div>
          <div class="ct-scheduled-details">
            <span class="ct-mode-badge">${modeIcon} ${modeText}</span>
            ${click.mode === "element" ? 
              `<span class="ct-element-tag">${click.element?.tagName?.toLowerCase() || 'N/A'}</span>` :
              `<span class="ct-coords-text">X: ${click.x}, Y: ${click.y}</span>`
            }
          </div>
          <div class="ct-countdown">⏱️ ${minutesLeft} min left</div>
        </div>
        <button class="ct-delete-scheduled" data-id="${click.id}">🗑️</button>
      </div>
    `;
  }).join('');
}

function updateScheduledList() {
  const list = document.getElementById("ct-scheduled-list");
  if (list) {
    list.innerHTML = renderScheduledClicks();
    
    // Re-attach delete listeners
    list.querySelectorAll(".ct-delete-scheduled").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = parseInt(e.target.closest(".ct-delete-scheduled").dataset.id);
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
  pickerOverlay.id = "ct-picker-overlay";
  pickerOverlay.innerHTML = `
    <div class="ct-picker-toolbar">
      <span class="ct-picker-title">🎯 Click to select an element</span>
      <button id="ct-picker-cancel" class="ct-picker-btn">Cancel (ESC)</button>
    </div>
  `;
  document.body.appendChild(pickerOverlay);
  
  // Create highlight box
  pickerHighlight = document.createElement("div");
  pickerHighlight.id = "ct-picker-highlight";
  document.body.appendChild(pickerHighlight);
  
  // Event listeners
  document.addEventListener("mousemove", handlePickerMouseMove);
  document.addEventListener("click", handlePickerClick, true);
  document.addEventListener("keydown", handlePickerKeydown);
  
  document.getElementById("ct-picker-cancel").addEventListener("click", cancelPicker);
}

function handlePickerMouseMove(e) {
  if (!isPickerActive) return;
  
  const element = document.elementFromPoint(e.clientX, e.clientY);
  if (!element || element.id === "ct-picker-highlight" || element.closest("#ct-picker-overlay")) {
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
  if (target.closest("#ct-picker-overlay") || target.id === "ct-picker-highlight") {
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

  const existingModal = document.getElementById("ct-extension-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "ct-extension-modal";
  
  modal.innerHTML = `
    <div class="ct-modal-content">
      <h3>⏰ Schedule Click</h3>
      <p>When should it be clicked?</p>
      <input type="time" id="ct-time-input" required step="1">
      
      <div class="ct-quick-time">
        <button class="ct-quick-btn" data-minutes="5">+5m</button>
        <button class="ct-quick-btn" data-minutes="30">+30m</button>
        <button class="ct-quick-btn" data-minutes="60">+1h</button>
        <button class="ct-quick-btn" data-minutes="300">+5h</button>
      </div>
      
      <div class="ct-mode-selector">
        <label class="ct-mode-label">Click mode:</label>
        <div class="ct-mode-options">
          <label class="ct-mode-option">
            <input type="radio" name="click-mode" value="element" checked>
            <span class="ct-mode-icon">🎯</span>
            <span class="ct-mode-text">Element</span>
          </label>
          <label class="ct-mode-option">
            <input type="radio" name="click-mode" value="coordinates">
            <span class="ct-mode-icon">📍</span>
            <span class="ct-mode-text">Coordinates</span>
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

  // Quick time buttons
  modal.querySelectorAll('.ct-quick-btn').forEach(btn => {
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
  document.getElementById("ct-confirm").addEventListener("click", () => scheduleClick(modal));
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

function scheduleClick(modal) {
  const timeInput = document.getElementById("ct-time-input").value;
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
  const contentDiv = modal.querySelector(".ct-modal-content");
  
  const timeStr = targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = isTomorrow ? "tomorrow" : "today";
  const modeStr = clickMode === "coordinates" ? "at exact coordinates" : "on the web element";

  contentDiv.innerHTML = `
    <span class="ct-success-icon">✓</span>
    <h3>✅ Scheduled!</h3>
    <p>The click will be performed ${dayStr} at <span class="ct-highlight">${timeStr}</span> ${modeStr}.</p>
    <p style="font-size: 0.9em; opacity: 0.8;">⏱️ About ${minutesLeft} minutes left</p>
    <div class="ct-buttons">
      <button id="ct-close-success">Close</button>
    </div>
  `;

  document.getElementById("ct-close-success").addEventListener("click", () => modal.remove());
}

function showError(title, message) {
  const errorModal = document.createElement("div");
  errorModal.id = "ct-extension-error-modal";
  errorModal.innerHTML = `
    <div class="ct-modal-content">
      <h3 style="color: var(--ct-error-color);">⚠️ ${title}</h3>
      <p>${message}</p>
      <div class="ct-buttons">
        <button id="ct-error-close">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(errorModal);
  
  document.getElementById("ct-error-close").addEventListener("click", () => errorModal.remove());
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
