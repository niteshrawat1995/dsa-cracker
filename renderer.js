const { ipcRenderer } = require('electron');
const AudioRecorder = require('./audio-recorder');

const textInput = document.getElementById('textInput');
const displayText = document.getElementById('displayText');
const askAiBtn = document.getElementById('askAiBtn');
const micBtn = document.getElementById('micBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const statusIndicator = document.getElementById('statusIndicator');
const whisperMode = document.getElementById('whisperMode');
const speechacesMode = document.getElementById('speechacesMode');
const audioPlayer = document.getElementById('audioPlayer');
const audioElement = document.getElementById('audioElement');
const assessmentResults = document.getElementById('assessmentResults');

let isProcessing = false;
let audioRecorder = null;
let isRecording = false;
let currentMode = 'whisper';
let lastRecordedBlob = null;
let overlayFocused = false;

// Removed updateDisplay function - no longer needed without Update button

// Format text with code block detection and formatting
function formatTextWithCode(text) {
  if (!text) return '';
  
  // Detect and format code blocks (```language\ncode\n```)
  let formattedText = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, language, code) => {
    const lang = language || 'code';
    const codeId = 'code_' + Math.random().toString(36).substr(2, 9);
    // Preserve indentation by only trimming trailing whitespace and leading/trailing newlines
    const cleanCode = code.replace(/^\n+|\n+$/g, '');
    return createCodeBlock(cleanCode, lang, codeId);
  });
  
  // Detect and format inline code (`code`)
  formattedText = formattedText.replace(/`([^`]+)`/g, '<span class="inline-code">$1</span>');
  
  // Convert line breaks to HTML
  formattedText = formattedText.replace(/\n/g, '<br>');
  
  return formattedText;
}

// Create a formatted code block with copy functionality
function createCodeBlock(code, language, codeId) {
  const highlightedCode = applySyntaxHighlighting(code, language);
  return `
    <div class="code-block">
      <div class="code-header">
        <span class="code-language">${language}</span>
        <button class="copy-button" onclick="copyCodeToClipboard('${codeId}')">Copy</button>
      </div>
      <code id="${codeId}">${highlightedCode}</code>
    </div>
  `;
}

// Basic syntax highlighting for Python code
function applySyntaxHighlighting(code, language) {
  // Focus on Python only and apply highlighting first, then escape
  let highlighted;
  
  if (language.toLowerCase() === 'python' || language.toLowerCase() === 'py') {
    highlighted = highlightPython(code);
  } else {
    // For non-Python code, just escape and return
    highlighted = escapeHtml(code);
  }
  
  return highlighted;
}

// Removed JavaScript highlighting - focusing only on Python

// Python syntax highlighting with proper HTML escaping
function highlightPython(code) {
  // Helper function to escape HTML in matched content only
  function escapeContent(text) {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#39;');
  }
  
  // Step 1: Escape the entire code first
  let highlighted = escapeContent(code);
  
  // Step 2: Apply syntax highlighting with clean HTML tags
  
  // Comments first (# to end of line)
  highlighted = highlighted.replace(/(#.*$)/gm, '<span class="code-comment">$1</span>');
  
  // Triple quoted strings (multiline)
  highlighted = highlighted.replace(/("""[\s\S]*?""")/g, '<span class="code-string">$1</span>');
  highlighted = highlighted.replace(/('''[\s\S]*?''')/g, '<span class="code-string">$1</span>');
  
  // Regular strings (single and double quotes)
  highlighted = highlighted.replace(/(&quot;)((?:\\.|(?!&quot;)[^\\])*?)(&quot;)/g, '<span class="code-string">$1$2$3</span>');
  highlighted = highlighted.replace(/(&#39;)((?:\\.|(?!&#39;)[^\\])*?)(&#39;)/g, '<span class="code-string">$1$2$3</span>');
  
  // Python keywords (only outside of already highlighted content)
  highlighted = highlighted.replace(/\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|with|lambda|and|or|not|in|is|True|False|None)\b(?![^<]*<\/span>)/g, 
    '<span class="code-keyword">$1</span>');
  
  // Numbers
  highlighted = highlighted.replace(/\b(\d+\.?\d*)\b(?![^<]*<\/span>)/g, '<span class="code-number">$1</span>');
  
  return highlighted;
}

// Removed HTML, CSS, and Generic highlighting - focusing only on Python

// Escape HTML to prevent injection
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Copy code to clipboard
function copyCodeToClipboard(codeId) {
  const codeElement = document.getElementById(codeId);
  if (codeElement) {
    const text = codeElement.textContent;
    navigator.clipboard.writeText(text).then(() => {
      // Show feedback
      const copyButton = codeElement.parentNode.querySelector('.copy-button');
      const originalText = copyButton.textContent;
      copyButton.textContent = 'Copied!';
      copyButton.style.backgroundColor = 'rgba(40, 167, 69, 0.3)';
      
      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.style.backgroundColor = '';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy code:', err);
      updateStatus('error', 'Failed to copy code');
    });
  }
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
      model: 'gpt-4',
      maxTokens: 6000,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant. Provide concise but comprehensive responses suitable for an overlay display. When providing code examples, use proper markdown formatting with language-specific code blocks.'
    });
    
    if (result && result.success) {
      // Show AI response with code formatting
      const aiResponse = `AI: ${result.response}`;
      displayText.innerHTML = formatTextWithCode(aiResponse);
      updateStatus('success', 'Response generated successfully');
    } else {
      displayText.innerHTML = formatTextWithCode(`Error: ${result?.error || 'Unknown error'}`);
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
function setLoading(loading, message = 'Thinking...') {
  if (loadingIndicator) {
    loadingIndicator.style.display = loading ? 'inline' : 'none';
  }
  if (askAiBtn) {
    askAiBtn.disabled = loading;
    askAiBtn.textContent = loading && message.includes('AI') ? message : 'Ask AI';
  }
  if (micBtn) {
    micBtn.disabled = loading && !isRecording;
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

// Initialize audio recorder
async function initializeAudioRecorder() {
  if (!AudioRecorder.isSupported()) {
    updateStatus('error', 'Audio recording not supported');
    if (micBtn) micBtn.disabled = true;
    return false;
  }

  try {
    audioRecorder = new AudioRecorder();
    
    audioRecorder.onRecordingComplete = async (audioBlob) => {
      lastRecordedBlob = audioBlob;
      setRecordingState(false);
      
      if (currentMode === 'whisper') {
        await processWhisperTranscription(audioBlob);
      } else if (currentMode === 'speechaces') {
        await processSpeechAcesAssessment(audioBlob);
      }
    };
    
    audioRecorder.onError = (error) => {
      console.error('Audio recorder error:', error);
      updateStatus('error', 'Recording failed: ' + error.message);
      setRecordingState(false);
    };
    
    const initialized = await audioRecorder.initialize();
    if (initialized) {
      updateStatus('success', 'Microphone ready');
    } else {
      updateStatus('error', 'Failed to initialize microphone');
      if (micBtn) micBtn.disabled = true;
    }
    
    return initialized;
  } catch (error) {
    console.error('Failed to initialize audio recorder:', error);
    updateStatus('error', 'Microphone access denied');
    if (micBtn) micBtn.disabled = true;
    return false;
  }
}

// Handle microphone button click
async function toggleRecording() {
  if (isProcessing) return;
  
  if (!audioRecorder) {
    await initializeAudioRecorder();
    if (!audioRecorder) return;
  }
  
  if (isRecording) {
    // Stop recording
    audioRecorder.stopRecording();
  } else {
    // Start recording
    setRecordingState(true);
    const started = audioRecorder.startRecording();
    if (!started) {
      setRecordingState(false);
      updateStatus('error', 'Failed to start recording');
    } else {
      updateStatus('success', `Recording for ${currentMode}...`);
    }
  }
}

// Set recording visual state
function setRecordingState(recording) {
  isRecording = recording;
  if (micBtn) {
    micBtn.classList.toggle('recording', recording);
    micBtn.textContent = recording ? '⏹️' : '🎤';
    micBtn.title = recording ? 'Stop Recording' : 'Start Recording';
  }
}

// Process Whisper transcription
async function processWhisperTranscription(audioBlob) {
  if (isProcessing) return;
  
  isProcessing = true;
  setLoading(true, 'Transcribing...');
  
  try {
    // Convert blob to array buffer for IPC transmission
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const result = await ipcRenderer.invoke('whisper-transcribe', buffer);
    
    if (result && result.success) {
      textInput.value = result.text;
      displayText.innerHTML = formatTextWithCode(result.text);
      updateStatus('success', 'Speech transcribed successfully');
      
      // Auto-trigger AI if text was transcribed
      if (result.text && result.text.trim().length > 0) {
        setTimeout(() => askAI(), 500);
      }
    } else {
      updateStatus('error', result?.error || 'Transcription failed');
    }
  } catch (error) {
    console.error('Whisper transcription failed:', error);
    updateStatus('error', 'Failed to transcribe speech');
  } finally {
    isProcessing = false;
    setLoading(false);
  }
}

// Process SpeechAces assessment
async function processSpeechAcesAssessment(audioBlob) {
  if (isProcessing) return;
  
  const textToAssess = textInput.value.trim();
  if (!textToAssess) {
    updateStatus('error', 'Please enter text to assess pronunciation against');
    return;
  }
  
  isProcessing = true;
  setLoading(true, 'Assessing...');
  
  try {
    // Convert blob to array buffer for IPC transmission
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const result = await ipcRenderer.invoke('speechaces-assess', buffer, textToAssess);
    
    if (result && result.success) {
      displayAssessmentResults(result);
      updateStatus('success', 'Pronunciation assessed successfully');
    } else {
      updateStatus('error', result?.error || 'Assessment failed');
    }
  } catch (error) {
    console.error('SpeechAces assessment failed:', error);
    updateStatus('error', 'Failed to assess pronunciation');
  } finally {
    isProcessing = false;
    setLoading(false);
  }
}

// Display assessment results
function displayAssessmentResults(results) {
  const overallScore = document.getElementById('overallScore');
  const pronunciationScore = document.getElementById('pronunciationScore');
  const fluencyScore = document.getElementById('fluencyScore');
  const feedbackText = document.getElementById('feedbackText');
  
  if (overallScore) {
    overallScore.textContent = results.overall_score ? Math.round(results.overall_score) : '-';
    overallScore.className = getScoreClass(results.overall_score);
  }
  
  if (pronunciationScore) {
    pronunciationScore.textContent = results.pronunciation_score ? Math.round(results.pronunciation_score) : '-';
    pronunciationScore.className = getScoreClass(results.pronunciation_score);
  }
  
  if (fluencyScore) {
    fluencyScore.textContent = results.fluency_score ? Math.round(results.fluency_score) : '-';
    fluencyScore.className = getScoreClass(results.fluency_score);
  }
  
  if (feedbackText) {
    feedbackText.textContent = results.feedback_summary || 'Assessment completed.';
  }
  
  assessmentResults.style.display = 'block';
}

// Get CSS class based on score
function getScoreClass(score) {
  if (!score) return 'score-value';
  if (score >= 80) return 'score-value';
  if (score >= 60) return 'score-value medium';
  return 'score-value low';
}

// Removed speakResponse function - no longer needed without Speaker button

// Handle mode toggle
function switchMode(mode) {
  currentMode = mode;
  
  // Update UI
  whisperMode.classList.toggle('active', mode === 'whisper');
  speechacesMode.classList.toggle('active', mode === 'speechaces');
  
  // Hide/show relevant UI elements
  if (mode === 'speechaces') {
    assessmentResults.style.display = assessmentResults.innerHTML.trim() ? 'block' : 'none';
  } else {
    assessmentResults.style.display = 'none';
  }
  
  updateStatus('success', `Switched to ${mode} mode`);
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

// Handle overlay focus changes from main process
function handleOverlayFocusChange(event, focused) {
  overlayFocused = focused;
  updateOverlayFocusUI();
}

// Update UI based on overlay focus
function updateOverlayFocusUI() {
  const body = document.body;
  if (overlayFocused) {
    body.classList.add('overlay-focused');
  } else {
    body.classList.remove('overlay-focused');
  }
}

// Toggle overlay focus manually
async function toggleOverlayFocus() {
  try {
    const result = await ipcRenderer.invoke('toggle-overlay-focus');
    console.log('Overlay focus toggled:', result.focused);
  } catch (error) {
    console.error('Failed to toggle overlay focus:', error);
  }
}

// Check all services status
async function checkServicesStatus() {
  await checkOpenAIStatus();
  
  try {
    const speechStatus = await ipcRenderer.invoke('speech-services-check-status');
    
    if (speechStatus.whisper_ready) {
      console.log('Whisper service ready');
    } else {
      console.warn('Whisper service not ready');
    }
    
    if (speechStatus.speechaces_ready) {
      console.log('SpeechAces service ready');
    } else {
      console.warn('SpeechAces service not ready - API key may be missing');
    }
    
    if (speechStatus.elevenlabs_ready) {
      console.log('ElevenLabs service ready');
    } else {
      console.warn('ElevenLabs service not ready - API key may be missing');
    }
    
  } catch (error) {
    console.error('Failed to check speech services status:', error);
  }
}

// Event listeners
// Removed textInput input listener and submitBtn click listener

if (askAiBtn) {
  askAiBtn.addEventListener('click', askAI);
}

if (micBtn) {
  micBtn.addEventListener('click', toggleRecording);
}

// Removed speakBtn event listener

// Mode toggle listeners
if (whisperMode) {
  whisperMode.addEventListener('click', () => switchMode('whisper'));
}

if (speechacesMode) {
  speechacesMode.addEventListener('click', () => switchMode('speechaces'));
}

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+Space: Toggle recording
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault();
    toggleRecording();
  }
  
  // Removed Ctrl+Enter shortcut for speaking
  
  // Ctrl+Shift+T: Toggle overlay focus manually
  if (e.ctrlKey && e.shiftKey && e.key === 'T') {
    e.preventDefault();
    toggleOverlayFocus();
  }
});

// Handle Enter key
textInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      askAI();
    }
    // Removed else clause for updateDisplay - Enter key now only works with Shift
  }
});

// Listen for overlay focus changes from main process
ipcRenderer.on('overlay-focus-changed', handleOverlayFocusChange);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (audioRecorder) {
    audioRecorder.destroy();
  }
});

// Initialize
checkServicesStatus();
initializeAudioRecorder();