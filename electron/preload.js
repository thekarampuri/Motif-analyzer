const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Called by renderer when it wants the latest bitmap list
  requestBitmaps: () => ipcRenderer.send('request-bitmaps'),

  // Register listener for bitmap updates from main process
  onBitmapsUpdated: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('bitmaps-updated', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('bitmaps-updated', handler);
  },

  // Save BMP bytes to disk via Electron main process
  saveBmp: (fileName, buffer) =>
    ipcRenderer.invoke('save-bmp', { fileName, buffer }),

  // Show native save dialog
  showSaveDialog: (defaultName) =>
    ipcRenderer.invoke('show-save-dialog', { defaultName }),
});
