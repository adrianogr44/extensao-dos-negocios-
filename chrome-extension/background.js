chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD') {
    const opts = {
      url: message.url,
      filename: 'FabricaReels/' + message.filename,
      saveAs: false,
    }
    if (Array.isArray(message.headers) && message.headers.length > 0) {
      opts.headers = message.headers
    }
    chrome.downloads.download(opts, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message })
      } else {
        sendResponse({ success: true, downloadId })
      }
    })
    return true
  }
})
