const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

class WhisperService {
  constructor(openaiClient) {
    this.client = openaiClient;
    this.isInitialized = false;
    this.tempDir = path.join(__dirname, 'temp');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  initialize(client) {
    if (client) {
      this.client = client;
    }
    this.isInitialized = !!this.client;
    return this.isInitialized;
  }

  async transcribeAudio(audioBuffer, options = {}) {
    if (!this.isInitialized || !this.client) {
      throw new Error('Whisper service not initialized. Please check your OpenAI API key.');
    }

    const {
      model = 'whisper-1',
      language = null, // Auto-detect if not specified
      prompt = null,   // Context for better accuracy
      response_format = 'json',
      temperature = 0.2 // Lower temperature for more consistent results
    } = options;

    try {
      // Convert buffer to temporary file for OpenAI API
      const tempFilePath = await this.blobToTempFile(audioBuffer);
      
      // Build request object with only non-null values
      const requestParams = {
        file: fs.createReadStream(tempFilePath),
        model: model,
        response_format: response_format,
        temperature: temperature
      };

      // Only add optional parameters if they have values
      if (language) {
        requestParams.language = language;
      }
      
      if (prompt) {
        requestParams.prompt = prompt;
      }

      const transcription = await this.client.audio.transcriptions.create(requestParams);

      // Clean up temporary file
      this.cleanupTempFile(tempFilePath);

      return {
        success: true,
        text: transcription.text,
        language: transcription.language || 'auto-detected',
        duration: transcription.duration,
        segments: transcription.segments || null
      };

    } catch (error) {
      console.error('Whisper transcription error:', error);
      
      let errorMessage = 'Failed to transcribe audio';
      
      if (error.code === 'insufficient_quota') {
        errorMessage = 'API quota exceeded. Please check your billing.';
      } else if (error.code === 'invalid_api_key') {
        errorMessage = 'Invalid API key. Please check your configuration.';
      } else if (error.code === 'rate_limit_exceeded') {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (error.message?.includes('file size')) {
        errorMessage = 'Audio file too large. Maximum size is 25MB.';
      } else if (error.message?.includes('audio format')) {
        errorMessage = 'Unsupported audio format. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
        originalError: error
      };
    }
  }

  async translateAudio(audioBuffer, options = {}) {
    if (!this.isInitialized || !this.client) {
      throw new Error('Whisper service not initialized. Please check your OpenAI API key.');
    }

    const {
      model = 'whisper-1',
      prompt = null,
      response_format = 'json',
      temperature = 0.2
    } = options;

    try {
      const tempFilePath = await this.blobToTempFile(audioBuffer);
      
      // Build request object with only non-null values
      const requestParams = {
        file: fs.createReadStream(tempFilePath),
        model: model,
        response_format: response_format,
        temperature: temperature
      };

      // Only add optional parameters if they have values
      if (prompt) {
        requestParams.prompt = prompt;
      }

      const translation = await this.client.audio.translations.create(requestParams);

      this.cleanupTempFile(tempFilePath);

      return {
        success: true,
        text: translation.text,
        originalLanguage: 'auto-detected',
        targetLanguage: 'English',
        duration: translation.duration
      };

    } catch (error) {
      console.error('Whisper translation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to translate audio',
        originalError: error
      };
    }
  }

  async blobToTempFile(audioBuffer) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `audio_${timestamp}_${randomId}.webm`;
    const filePath = path.join(this.tempDir, fileName);

    return new Promise((resolve, reject) => {
      // audioBuffer should already be a Buffer from the renderer process
      fs.writeFile(filePath, audioBuffer, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(filePath);
        }
      });
    });
  }

  cleanupTempFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn('Failed to cleanup temp file:', filePath, error);
    }
  }

  // Clean up old temp files (older than 1 hour)
  cleanupOldTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          this.cleanupTempFile(filePath);
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup old temp files:', error);
    }
  }

  // Get audio file info
  getAudioInfo(buffer) {
    return {
      size: buffer.length,
      type: 'audio/webm', // Default type since we can't detect from buffer
      sizeMB: (buffer.length / (1024 * 1024)).toFixed(2),
      isValidSize: buffer.length <= 25 * 1024 * 1024, // 25MB limit
      supportedFormats: [
        'audio/webm',
        'audio/mp3',
        'audio/mp4',
        'audio/mpeg',
        'audio/wav',
        'audio/m4a'
      ]
    };
  }

  // Check if service is ready
  isReady() {
    return this.isInitialized && this.client !== null;
  }

  // Validate audio buffer before processing
  validateAudioBuffer(buffer) {
    if (!buffer || buffer.length === 0) {
      return { valid: false, error: 'Empty audio file' };
    }

    if (buffer.length > 25 * 1024 * 1024) {
      return { valid: false, error: 'Audio file too large (max 25MB)' };
    }

    return { valid: true };
  }

  // Get supported models
  getSupportedModels() {
    return [
      {
        id: 'whisper-1',
        name: 'Whisper V1',
        description: 'General-purpose speech recognition model',
        languages: 'Multilingual (99+ languages)',
        maxFileSize: '25MB'
      }
    ];
  }

  // Destroy service and cleanup
  destroy() {
    this.cleanupOldTempFiles();
    this.isInitialized = false;
    this.client = null;
  }
}

module.exports = WhisperService;