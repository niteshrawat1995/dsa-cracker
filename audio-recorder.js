class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.stream = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.onDataAvailable = null;
    this.onRecordingComplete = null;
    this.onError = null;
  }

  async initialize() {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Optimal for speech recognition
          channelCount: 1     // Mono recording
        } 
      });
      
      // Create MediaRecorder with WebM format (compatible with Whisper)
      const options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        // Fallback to default
        this.mediaRecorder = new MediaRecorder(this.stream);
      } else {
        this.mediaRecorder = new MediaRecorder(this.stream, options);
      }

      // Set up event handlers
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          if (this.onDataAvailable) {
            this.onDataAvailable(event.data);
          }
        }
      });

      this.mediaRecorder.addEventListener('stop', () => {
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
        this.recordedChunks = [];
        if (this.onRecordingComplete) {
          this.onRecordingComplete(blob);
        }
      });

      this.mediaRecorder.addEventListener('error', (event) => {
        console.error('MediaRecorder error:', event.error);
        if (this.onError) {
          this.onError(event.error);
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize audio recorder:', error);
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }

  startRecording() {
    if (!this.mediaRecorder || this.isRecording) {
      return false;
    }

    try {
      this.recordedChunks = [];
      this.mediaRecorder.start(100); // Collect data every 100ms for real-time processing
      this.isRecording = true;
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }

  stopRecording() {
    if (!this.mediaRecorder || !this.isRecording) {
      return false;
    }

    try {
      this.mediaRecorder.stop();
      this.isRecording = false;
      return true;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }

  pauseRecording() {
    if (!this.mediaRecorder || !this.isRecording) {
      return false;
    }

    try {
      this.mediaRecorder.pause();
      return true;
    } catch (error) {
      console.error('Failed to pause recording:', error);
      return false;
    }
  }

  resumeRecording() {
    if (!this.mediaRecorder || !this.isRecording) {
      return false;
    }

    try {
      this.mediaRecorder.resume();
      return true;
    } catch (error) {
      console.error('Failed to resume recording:', error);
      return false;
    }
  }

  getRecordingState() {
    return {
      isRecording: this.isRecording,
      state: this.mediaRecorder ? this.mediaRecorder.state : 'inactive',
      mimeType: this.mediaRecorder ? this.mediaRecorder.mimeType : null
    };
  }

  // Convert Blob to File for API uploads
  blobToFile(blob, filename = 'recording.webm') {
    return new File([blob], filename, { 
      type: blob.type,
      lastModified: Date.now()
    });
  }

  // Get audio duration from blob (approximate)
  async getAudioDuration(blob) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });
      audio.addEventListener('error', () => {
        resolve(0);
      });
      audio.src = URL.createObjectURL(blob);
    });
  }

  // Clean up resources
  destroy() {
    if (this.isRecording) {
      this.stopRecording();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }

  // Check if audio recording is supported
  static isSupported() {
    return !!(navigator.mediaDevices && 
              navigator.mediaDevices.getUserMedia && 
              window.MediaRecorder);
  }

  // Get supported MIME types
  static getSupportedMimeTypes() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ];
    
    return types.filter(type => MediaRecorder.isTypeSupported(type));
  }
}

module.exports = AudioRecorder;