
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file
const schedule = require('node-schedule');
const db = require('./database.js');
const { GoogleGenAI } = require('@google/genai');

async function createWindow() {
  const isDev = (await import('electron-is-dev')).default;

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'icon.ico'),
    title: "مكتب الأفوكاتو للمحاماة"
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  
  if (isDev) {
    win.webContents.openDevTools();
  }
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  db.init();
  createWindow();

  schedule.scheduleJob('0 2 * * *', () => {
    console.log('Running scheduled backup...');
    db.backupDatabase();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.close();
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('login', async (event, { username, password }) => {
  try {
    const user = db.attemptLogin(username, password);
    return { success: true, user };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-stats', async () => {
  try {
    const stats = db.getDashboardStats();
    return { success: true, stats };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('manual-backup', async () => {
  try {
    const result = db.backupDatabase();
    return { success: true, message: `تم إنشاء نسخة احتياطية بنجاح في: ${result.path}` };
  } catch (error) {
    return { success: false, message: `فشل إنشاء النسخة الاحتياطية: ${error.message}` };
  }
});

ipcMain.handle('ask-ai', async (event, prompt) => {
    try {
        if (!process.env.API_KEY) {
            console.error('Gemini API key is not configured. Please create a .env file with API_KEY.');
            throw new Error('لم يتم تكوين مفتاح API الخاص بالذكاء الاصطناعي. يرجى مراجعة ملف README.');
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = "أنت مساعد قانوني خبير متخصص في القانون المصري. قدم إجابات موجزة ودقيقة ومفيدة للأسئلة القانونية. اذكر دائمًا أنك مساعد ذكاء اصطناعي وأن المعلومات المقدمة لا ينبغي اعتبارها بديلاً عن الاستشارة القانونية المتخصصة من محامٍ مؤهل.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        return { success: true, text: response.text };
    } catch (error) {
        console.error('AI Error:', error);
        return { success: false, message: error.message };
    }
});

// Client IPC Handlers
ipcMain.handle('get-clients', async () => {
    try {
        const clients = db.getClients();
        return { success: true, clients };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-client-list', async () => {
    try {
        const clientList = db.getClientList();
        return { success: true, clientList };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('add-client', async (event, client) => {
    try {
        const newClient = db.addClient(client);
        return { success: true, client: newClient };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('update-client', async (event, client) => {
    try {
        const updatedClient = db.updateClient(client);
        return { success: true, client: updatedClient };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('delete-client', async (event, id) => {
    try {
        const result = db.deleteClient(id);
        return { success: result.success };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// Case IPC Handlers
ipcMain.handle('get-cases', async () => {
    try {
        const cases = db.getCases();
        return { success: true, cases };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('add-case', async (event, caseData) => {
    try {
        const newCase = db.addCase(caseData);
        return { success: true, case: newCase };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('update-case', async (event, caseData) => {
    try {
        const updatedCase = db.updateCase(caseData);
        return { success: true, case: updatedCase };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('delete-case', async (event, id) => {
    try {
        const result = db.deleteCase(id);
        return { success: result.success };
    } catch (error) {
        return { success: false, message: error.message };
    }
});
