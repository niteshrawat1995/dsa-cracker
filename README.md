# Electron Overlay Demo

An Electron application that creates a transparent overlay window with AI-powered features including speech recognition, text generation, pronunciation assessment, and text-to-speech capabilities.

## Features

- **Transparent Overlay**: Always-on-top transparent window that's invisible during screen sharing
- **AI Text Generation**: Integration with OpenAI's ChatGPT for intelligent responses
- **Speech Recognition**: Whisper-powered speech-to-text functionality
- **Pronunciation Assessment**: SpeechAces integration for pronunciation scoring and feedback
- **Text-to-Speech**: ElevenLabs integration for audio synthesis
- **Toggle Focus**: Switch between click-through and interactive modes
- **Resizable Window**: Draggable and resizable overlay interface
- **Global Shortcuts**: System-wide keyboard shortcuts for quick access

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd electron-overlay-demo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file and add your API keys:
   - `OPENAI_API_KEY`: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
   - `SPEECHACES_API_KEY`: Get from [SpeechAces API Plans](https://www.speechace.com/api-plans/)
   - `ELEVENLABS_API_KEY`: Get from [ElevenLabs Developers](https://elevenlabs.io/developers)

4. **Start the application**
   ```bash
   npm start
   ```

## Usage

### Global Shortcuts
- **Ctrl+Shift+O**: Toggle overlay focus (switch between click-through and interactive modes)
- **Shift+Enter**: Ask AI (when input field is focused)
- **Ctrl+Space**: Start/stop audio recording

### Interface Controls
- **Text Input**: Type questions or text for AI processing
- **Ask AI Button**: Submit text to OpenAI for intelligent responses
- **Microphone Button**: Record audio for speech-to-text or pronunciation assessment
- **Mode Toggle**: Switch between Whisper (transcription) and SpeechAces (assessment) modes

### Speech Services
1. **Whisper Mode**: Converts speech to text using OpenAI's Whisper model
2. **SpeechAces Mode**: Provides pronunciation assessment with scoring and feedback

### Window Management
- **Drag**: Click and drag anywhere on the overlay to move it
- **Resize**: Use the invisible resize handles at window edges and corners
- **Focus Toggle**: Use Ctrl+Shift+O to switch between transparent and interactive modes

## Technical Details

### Architecture
- **Main Process**: `main.js` - Handles window creation, global shortcuts, and IPC communication
- **Renderer Process**: `renderer.js` - Manages UI interactions and service communication
- **Services**: Modular API integrations for OpenAI, Whisper, SpeechAces, and ElevenLabs

### Key Technologies
- **Electron**: Cross-platform desktop app framework
- **OpenAI API**: GPT models for text generation and Whisper for speech recognition
- **SpeechAces API**: Pronunciation assessment and fluency scoring
- **ElevenLabs API**: High-quality text-to-speech synthesis

### Security Features
- Environment variables for secure API key storage
- Content protection to prevent screen capture on supported platforms
- Click-through mode for non-intrusive overlay behavior

## Development

### Project Structure
```
├── main.js                 # Electron main process
├── renderer.js             # UI logic and service communication
├── index.html              # Application interface
├── openai-service.js       # OpenAI API integration
├── whisper-service.js      # Whisper speech-to-text
├── speechaces-service.js   # SpeechAces pronunciation assessment
├── elevenlabs-service.js   # ElevenLabs text-to-speech
├── audio-recorder.js       # Audio recording utilities
├── package.json            # Dependencies and scripts
└── .env.example            # Environment variables template
```

### Running in Development
```bash
npm start
```

## Contributing

**Contributor**: [niteshrawat99@gmail.com](mailto:niteshrawat99@gmail.com)

## License

ISC