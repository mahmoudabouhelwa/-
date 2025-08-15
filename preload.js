
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth & System
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  getStats: () => ipcRenderer.invoke('get-stats'),
  manualBackup: () => ipcRenderer.invoke('manual-backup'),
  askAi: (prompt) => ipcRenderer.invoke('ask-ai', prompt),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },

  // Clients
  getClients: () => ipcRenderer.invoke('get-clients'),
  getClientList: () => ipcRenderer.invoke('get-client-list'),
  addClient: (client) => ipcRenderer.invoke('add-client', client),
  updateClient: (client) => ipcRenderer.invoke('update-client', client),
  deleteClient: (id) => ipcRenderer.invoke('delete-client', id),

  // Cases
  getCases: () => ipcRenderer.invoke('get-cases'),
  addCase: (caseData) => ipcRenderer.invoke('add-case', caseData),
  updateCase: (caseData) => ipcRenderer.invoke('update-case', caseData),
  deleteCase: (id) => ipcRenderer.invoke('delete-case', id),
});
