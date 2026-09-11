const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('speech', {
  check: () => ipcRenderer.invoke('speech:check'),
  saveCredential: key => ipcRenderer.invoke('speech:credential:save', key),
  clearCredential: () => ipcRenderer.invoke('speech:credential:clear'),
  transcribeRecording: (bytes, settings) => ipcRenderer.invoke('speech:recording', bytes, settings),
  transcribeFile: settings => ipcRenderer.invoke('speech:file', settings),
  cancel: () => ipcRenderer.invoke('speech:cancel'),
  saveText: text => ipcRenderer.invoke('speech:save', text),
  copyText: text => ipcRenderer.invoke('speech:copy', text),
  onProgress: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('speech:progress', listener);
    return () => ipcRenderer.removeListener('speech:progress', listener);
  }
});
