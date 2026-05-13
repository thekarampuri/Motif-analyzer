const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adminAPI', {
  checkReady:      ()      => ipcRenderer.invoke('check-ready'),
  getLicenses:     ()      => ipcRenderer.invoke('get-licenses'),
  generateLicense: (data)  => ipcRenderer.invoke('generate-license', data),
  deleteLicense:   (id)    => ipcRenderer.invoke('delete-license', id),
  copyText:        (text)  => ipcRenderer.invoke('copy-text', text),
  exportCSV:       ()      => ipcRenderer.invoke('export-csv'),
});
