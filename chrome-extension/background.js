chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD') {
    const filename = 'FabricaReels/' + message.filename
    chrome.downloads.download({
      url: message.url,
      filename: filename,
      saveAs: false,
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message })
      } else {
        sendResponse({ success: true, downloadId })
      }
    })
    return true
  }
})
