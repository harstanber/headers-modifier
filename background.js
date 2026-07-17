chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['hmState'], result => {
    if (!result.hmState) {
      chrome.storage.local.set({ hmState: { enabled: true, headers: [] } });
    }
  });
});
