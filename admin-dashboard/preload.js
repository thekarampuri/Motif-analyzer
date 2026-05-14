const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adminAPI', {
  checkReady:      ()          => ipcRenderer.invoke('check-ready'),
  getLicenses:     ()          => ipcRenderer.invoke('get-licenses'),
  generateLicense: (data)      => ipcRenderer.invoke('generate-license', data),
  setMachineId:    (data)      => ipcRenderer.invoke('set-machine-id', data),
  deleteLicense:   (id)        => ipcRenderer.invoke('delete-license', id),
  copyText:        (text)      => ipcRenderer.invoke('copy-text', text),
  exportCSV:       ()          => ipcRenderer.invoke('export-csv'),
  pickLogo:        ()          => ipcRenderer.invoke('pick-logo'),
  getConfig:       ()          => ipcRenderer.invoke('get-config'),
  setConfig:       (patch)     => ipcRenderer.invoke('set-config', patch),
  openFolder:      (p)         => ipcRenderer.invoke('open-folder', p),
  buildExe:        (data)      => ipcRenderer.invoke('build-exe', data),
  onBuildLog:      (cb)        => ipcRenderer.on('build-log', (_e, msg) => cb(msg)),
  offBuildLog:     (cb)        => ipcRenderer.removeListener('build-log', cb),
});
