const { ipcRenderer } = require('electron');

const textInput = document.getElementById('textInput');
const displayText = document.getElementById('displayText');
const submitBtn = document.getElementById('submitBtn');
const askAiBtn = document.getElementById('askAiBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const statusIndicator = document.getElementById('statusIndicator');

let isProcessing = false;

// Handle input changes
function updateDisplay() {
  const inputValue = textInput.value || 'Hello World!';
  displayText.textContent = inputValue;
}

// Handle AI request
async function askAI() {
  const userInput = textInput.value.trim();
  
  if (!userInput) {
    displayText.textContent = 'Please enter some text first!';
    return;
  }
  
  if (isProcessing) {
    return;
  }
  
  isProcessing = true;
  setLoading(true);
  
  try {
    // Show user input first
    displayText.textContent = `You: ${userInput}`;
    
    // Call OpenAI API through IPC
    const result = await ipcRenderer.invoke('openai-generate', userInput, {
      model: 'gpt-3.5-turbo',
      maxTokens: 100,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant. Provide concise responses suitable for an overlay display.'
    });
    
    if (result && result.success) {
      // Show AI response
      displayText.textContent = `AI: ${result.response}`;
      updateStatus('success', 'Response generated successfully');
    } else {
      displayText.textContent = `Error: ${result?.error || 'Unknown error'}`;
      updateStatus('error', result?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('AI request failed:', error);
    displayText.textContent = `Error: Failed to get AI response`;
    updateStatus('error', 'Request failed');
  } finally {
    isProcessing = false;
    setLoading(false);
  }
}

// Set loading state
function setLoading(loading) {
  if (loadingIndicator) {
    loadingIndicator.style.display = loading ? 'inline' : 'none';
  }
  if (askAiBtn) {
    askAiBtn.disabled = loading;
    askAiBtn.textContent = loading ? 'Thinking...' : 'Ask AI';
  }
}

// Update status indicator
function updateStatus(type, message) {
  if (statusIndicator) {
    statusIndicator.className = `status ${type}`;
    statusIndicator.textContent = message;
    statusIndicator.style.display = 'block';
    
    // Hide status after 3 seconds
    setTimeout(() => {
      statusIndicator.style.display = 'none';
    }, 3000);
  }
}

// Check OpenAI status on load
async function checkOpenAIStatus() {
  try {
    const status = await ipcRenderer.invoke('openai-check-status');
    if (!status.hasApiKey) {
      updateStatus('warning', 'OpenAI API key not configured');
      if (askAiBtn) askAiBtn.disabled = true;
    } else if (!status.isReady) {
      updateStatus('error', 'OpenAI service not ready');
      if (askAiBtn) askAiBtn.disabled = true;
    } else {
      updateStatus('success', 'OpenAI ready');
    }
  } catch (error) {
    console.error('Failed to check OpenAI status:', error);
    updateStatus('error', 'Failed to check AI status');
  }
}

// Event listeners
textInput.addEventListener('input', updateDisplay);
submitBtn.addEventListener('click', updateDisplay);

if (askAiBtn) {
  askAiBtn.addEventListener('click', askAI);
}

// Handle Enter key
textInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      askAI();
    } else {
      updateDisplay();
    }
  }
});

// Initialize
updateDisplay();
checkOpenAIStatus();