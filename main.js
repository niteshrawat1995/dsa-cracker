const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
require('dotenv').config();
const OpenAIService = require('./openai-service');
const WhisperService = require('./whisper-service');
const SpeechAcesService = require('./speechaces-service');
const ElevenLabsService = require('./elevenlabs-service');

let mainWindow;
const openaiService = new OpenAIService();
const whisperService = new WhisperService();
const speechacesService = new SpeechAcesService();
const elevenlabsService = new ElevenLabsService();

// Simple overlay focus state
let overlayFocused = false;

// Function to toggle overlay focus
function toggleOverlayFocus() {
  overlayFocused = !overlayFocused;
  updateOverlayFocus();
}

// Function to update overlay focus state
function updateOverlayFocus() {
  if (!mainWindow) return;
  
  if (overlayFocused) {
    // Enable overlay interaction
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setFocusable(true);
  } else {
    // Disable overlay interaction - click-through to background apps
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    mainWindow.setFocusable(false);
  }
  
  // Notify renderer about focus change
  mainWindow.webContents.send('overlay-focus-changed', overlayFocused);
}

function createWindow() {
  // Get screen dimensions for full screen overlay
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  // Create the browser window with overlay configuration
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 300,
    minHeight: 200,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Set window level to screen-saver to bypass screen capture
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // Enable click-through by default to allow interaction with other apps
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  
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
  
  // Register global shortcuts
  registerGlobalShortcuts();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      registerGlobalShortcuts();
    }
  });
});

// Function to register global shortcuts
function registerGlobalShortcuts() {
  try {
    // Toggle overlay focus: Ctrl+Shift+O
    globalShortcut.register('CommandOrControl+Shift+O', () => {
      toggleOverlayFocus();
    });
    
    console.log('Global shortcuts registered successfully');
  } catch (error) {
    console.error('Failed to register global shortcuts:', error);
  }
}

app.on('window-all-closed', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});

// Initialize all services when app is ready
app.whenReady().then(() => {
  // Initialize OpenAI service
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
    const initialized = openaiService.initialize(openaiApiKey);
    if (initialized) {
      console.log('OpenAI service initialized successfully');
      
      // Initialize Whisper service with OpenAI client
      whisperService.initialize(openaiService.client);
      console.log('Whisper service initialized successfully');
    } else {
      console.error('Failed to initialize OpenAI service');
    }
  } else {
    console.warn('OpenAI API key not found. Please set OPENAI_API_KEY in .env file');
  }
  
  // Initialize SpeechAces service
  const speechacesApiKey = process.env.SPEECHACES_API_KEY;
  if (speechacesApiKey && speechacesApiKey !== 'your_speechaces_api_key_here') {
    const initialized = speechacesService.initialize(speechacesApiKey);
    if (initialized) {
      console.log('SpeechAces service initialized successfully');
    } else {
      console.error('Failed to initialize SpeechAces service');
    }
  } else {
    console.warn('SpeechAces API key not found. Please set SPEECHACES_API_KEY in .env file');
  }
  
  // Initialize ElevenLabs service
  const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (elevenlabsApiKey && elevenlabsApiKey !== 'your_elevenlabs_api_key_here') {
    const initialized = elevenlabsService.initialize(elevenlabsApiKey);
    if (initialized) {
      console.log('ElevenLabs service initialized successfully');
    } else {
      console.error('Failed to initialize ElevenLabs service');
    }
  } else {
    console.warn('ElevenLabs API key not found. Please set ELEVENLABS_API_KEY in .env file');
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

// IPC handlers for Whisper speech-to-text
ipcMain.handle('whisper-transcribe', async (event, audioBuffer, options = {}) => {
  try {
    if (!whisperService.isReady()) {
      return {
        success: false,
        error: 'Whisper service not initialized. Please check your OpenAI API key.'
      };
    }

    const result = await whisperService.transcribeAudio(audioBuffer, options);
    return result;
  } catch (error) {
    console.error('IPC Whisper Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to transcribe audio'
    };
  }
});

// IPC handlers for SpeechAces assessment
ipcMain.handle('speechaces-assess', async (event, audioBuffer, text, options = {}) => {
  try {
    if (!speechacesService.isReady()) {
      return {
        success: false,
        error: 'SpeechAces service not initialized. Please check your API key.'
      };
    }

    const result = await speechacesService.assessPronunciation(audioBuffer, text, options);
    return result;
  } catch (error) {
    console.error('IPC SpeechAces Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to assess pronunciation'
    };
  }
});

// IPC handlers for ElevenLabs text-to-speech
ipcMain.handle('elevenlabs-tts', async (event, text, options = {}) => {
  try {
    if (!elevenlabsService.isReady()) {
      return {
        success: false,
        error: 'ElevenLabs service not initialized. Please check your API key.'
      };
    }

    const result = await elevenlabsService.textToSpeech(text, options);
    return result;
  } catch (error) {
    console.error('IPC ElevenLabs Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate speech'
    };
  }
});

// IPC handler for checking all speech services status
ipcMain.handle('speech-services-check-status', async () => {
  return {
    whisper_ready: whisperService.isReady(),
    whisper_has_key: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here',
    speechaces_ready: speechacesService.isReady(),
    speechaces_has_key: !!process.env.SPEECHACES_API_KEY && process.env.SPEECHACES_API_KEY !== 'your_speechaces_api_key_here',
    elevenlabs_ready: elevenlabsService.isReady(),
    elevenlabs_has_key: !!process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== 'your_elevenlabs_api_key_here'
  };
});

// IPC handlers for overlay focus
ipcMain.handle('toggle-overlay-focus', () => {
  toggleOverlayFocus();
  return { success: true, focused: overlayFocused };
});

ipcMain.handle('get-overlay-focus', () => {
  return { success: true, focused: overlayFocused };
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