chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "schedule-click",
    title: "Click at...",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "schedule-click") {
    chrome.tabs.sendMessage(tab.id, { action: "openModal" }).catch(err => {
      console.error("Can't send message. Page may not be fully loaded.", err);
    });
  }
});
