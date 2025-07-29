const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config();
const OpenAIService = require('./openai-service');

let mainWindow;
const openaiService = new OpenAIService();

function createWindow() {
  // Create the browser window with overlay configuration
  mainWindow = new BrowserWindow({
    width: 500,
    height: 400,
    minWidth: 300,
    minHeight: 200,
    maxWidth: 1000,
    maxHeight: 800,
    x: 100,
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Set window level to screen-saver to bypass screen capture
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // Don't make window click-through so users can interact with inputs
  // mainWindow.setIgnoreMouseEvents(true);
  
  // Load the HTML file
  mainWindow.loadFile('index.html');
  
  // Hide window from screen capture on macOS
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setContentProtection(true);
  }
  
  // Prevent window from being captured on Windows
  if (process.platform === 'win32') {
    mainWindow.setContentProtection(true);
  }
}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Initialize OpenAI service when app is ready
app.whenReady().then(() => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'your_openai_api_key_here') {
    const initialized = openaiService.initialize(apiKey);
    if (initialized) {
      console.log('OpenAI service initialized successfully');
    } else {
      console.error('Failed to initialize OpenAI service');
    }
  } else {
    console.warn('OpenAI API key not found. Please set OPENAI_API_KEY in .env file');
  }
});

// IPC handlers for OpenAI communication
ipcMain.handle('openai-generate', async (event, userInput, options = {}) => {
  try {
    if (!openaiService.isReady()) {
      return {
        success: false,
        error: 'OpenAI service not initialized. Please check your API key.'
      };
    }

    const result = await openaiService.generateResponse(userInput, options);
    return result;
  } catch (error) {
    console.error('IPC OpenAI Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process request'
    };
  }
});

ipcMain.handle('openai-check-status', async () => {
  return {
    isReady: openaiService.isReady(),
    hasApiKey: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
  };
});

// Window resize handlers
ipcMain.handle('get-window-bounds', () => {
  return mainWindow ? mainWindow.getBounds() : null;
});

ipcMain.handle('set-window-bounds', (event, bounds) => {
  if (mainWindow) {
    mainWindow.setBounds(bounds);
  }
});