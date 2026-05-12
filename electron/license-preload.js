const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('licenseAPI', {
  getMachineId: ()           => ipcRenderer.invoke('get-machine-id'),
  tryActivate:  (licenseKey) => ipcRenderer.invoke('try-activate', licenseKey),
});
