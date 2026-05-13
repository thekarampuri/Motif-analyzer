const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  requestBitmaps:    ()              => ipcRenderer.send('request-bitmaps'),
  onBitmapsUpdated:  (callback)      => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('bitmaps-updated', handler);
    return () => ipcRenderer.removeListener('bitmaps-updated', handler);
  },
  saveBmp:             (fileName, buffer) => ipcRenderer.invoke('save-bmp',    { fileName, buffer }),
  saveFile:            (fileName, buffer) => ipcRenderer.invoke('save-file',   { fileName, buffer }),
  showSaveDialog:      (defaultName, defaultDir)      => ipcRenderer.invoke('show-save-dialog',        { defaultName, defaultDir }),
  showSaveDialogFormat:(defaultName, fmt, defaultDir) => ipcRenderer.invoke('show-save-dialog-format', { defaultName, format: fmt, defaultDir }),
  showOpenProjectDialog: ()               => ipcRenderer.invoke('show-open-project-dialog'),
  saveProject: (filePath, data)           => ipcRenderer.invoke('save-project', { filePath, data }),
  loadProject: (filePath)                 => ipcRenderer.invoke('load-project', { filePath }),
});
