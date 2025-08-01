const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ElevenLabsService {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.isInitialized = false;
    this.defaultVoiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam voice (default)
    this.tempDir = path.join(__dirname, 'temp');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  initialize(apiKey) {
    if (!apiKey) {
      console.error('ElevenLabs API key is required');
      return false;
    }
    
    this.apiKey = apiKey;
    this.isInitialized = true;
    return true;
  }

  async textToSpeech(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ElevenLabs service not initialized. Please check your API key.');
    }

    const {
      voice_id = this.defaultVoiceId,
      model_id = 'eleven_flash_v2_5', // Fast, low-latency model
      output_format = 'mp3_44100_128',
      optimize_streaming_latency = 2,
      voice_settings = {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    } = options;

    try {
      const requestData = {
        text: text,
        model_id: model_id,
        voice_settings: voice_settings,
        output_format: output_format,
        optimize_streaming_latency: optimize_streaming_latency
      };

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voice_id}`,
        requestData,
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );

      // Convert response to blob for audio playback
      const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
      
      return {
        success: true,
        audio_blob: audioBlob,
        audio_url: URL.createObjectURL(audioBlob),
        text_length: text.length,
        voice_id: voice_id,
        model_id: model_id,
        output_format: output_format
      };

    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      
      let errorMessage = 'Failed to synthesize speech';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          errorMessage = 'Invalid ElevenLabs API key. Please check your configuration.';
        } else if (status === 402) {
          errorMessage = 'ElevenLabs quota exceeded. Please check your billing.';
        } else if (status === 413) {
          errorMessage = 'Text too long for ElevenLabs API.';
        } else if (status === 422) {
          errorMessage = 'Invalid voice settings or parameters.';
        } else if (data) {
          try {
            const errorData = typeof data === 'string' ? JSON.parse(data) : data;
            errorMessage = errorData.detail?.message || errorData.message || errorMessage;
          } catch (parseError) {
            // Keep default error message if parsing fails
          }
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.';
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

  async getVoices() {
    if (!this.isInitialized) {
      throw new Error('ElevenLabs service not initialized. Please check your API key.');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        },
        timeout: 10000
      });

      return {
        success: true,
        voices: response.data.voices.map(voice => ({
          voice_id: voice.voice_id,
          name: voice.name,
          category: voice.category,
          description: voice.description,
          preview_url: voice.preview_url,
          available_for_tiers: voice.available_for_tiers,
          settings: voice.settings
        }))
      };

    } catch (error) {
      console.error('ElevenLabs get voices error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch voices',
        originalError: error
      };
    }
  }

  async getModels() {
    if (!this.isInitialized) {
      throw new Error('ElevenLabs service not initialized. Please check your API key.');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: {
          'xi-api-key': this.apiKey
        },
        timeout: 10000
      });

      return {
        success: true,
        models: response.data.map(model => ({
          model_id: model.model_id,
          name: model.name,
          can_be_finetuned: model.can_be_finetuned,
          can_do_text_to_speech: model.can_do_text_to_speech,
          can_do_voice_conversion: model.can_do_voice_conversion,
          token_cost_factor: model.token_cost_factor,
          description: model.description,
          requires_alpha_access: model.requires_alpha_access,
          max_characters_request_free_tier: model.max_characters_request_free_tier,
          max_characters_request_subscribed_tier: model.max_characters_request_subscribed_tier
        }))
      };

    } catch (error) {
      console.error('ElevenLabs get models error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch models',
        originalError: error
      };
    }
  }

  async getUserInfo() {
    if (!this.isInitialized) {
      throw new Error('ElevenLabs service not initialized. Please check your API key.');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        headers: {
          'xi-api-key': this.apiKey
        },
        timeout: 10000
      });

      return {
        success: true,
        user_info: {
          subscription: response.data.subscription,
          xi_api_key: response.data.xi_api_key,
          voice_clone_available: response.data.can_clone_voices,
          can_extend_character_limit: response.data.can_extend_character_limit,
          allowed_to_extend_character_limit: response.data.allowed_to_extend_character_limit,
          next_character_count_reset_unix: response.data.next_character_count_reset_unix,
          character_count: response.data.character_count,
          character_limit: response.data.character_limit
        }
      };

    } catch (error) {
      console.error('ElevenLabs get user info error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch user info',
        originalError: error
      };
    }
  }

  // Stream text-to-speech for real-time playback
  async streamTextToSpeech(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ElevenLabs service not initialized. Please check your API key.');
    }

    const {
      voice_id = this.defaultVoiceId,
      model_id = 'eleven_flash_v2_5',
      optimize_streaming_latency = 4,
      voice_settings = {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    } = options;

    try {
      const requestData = {
        text: text,
        model_id: model_id,
        voice_settings: voice_settings,
        optimize_streaming_latency: optimize_streaming_latency
      };

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voice_id}/stream`,
        requestData,
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          responseType: 'stream',
          timeout: 30000
        }
      );

      return {
        success: true,
        audio_stream: response.data,
        voice_id: voice_id,
        model_id: model_id
      };

    } catch (error) {
      console.error('ElevenLabs streaming TTS error:', error);
      return {
        success: false,
        error: error.message || 'Failed to stream speech synthesis',
        originalError: error
      };
    }
  }

  // Get default voice options
  getDefaultVoices() {
    return [
      { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, authoritative male voice' },
      { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Pleasant, warm female voice' },
      { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm, articulate female voice' },
      { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong, confident female voice' },
      { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Josh', description: 'Friendly, professional male voice' }
    ];
  }

  // Get available models (static list for common models)
  getDefaultModels() {
    return [
      {
        model_id: 'eleven_flash_v2_5',
        name: 'Eleven Flash v2.5',
        description: 'Fastest model with ultra-low latency (~75ms)',
        latency: '~75ms',
        quality: 'High',
        languages: 32
      },
      {
        model_id: 'eleven_turbo_v2_5',
        name: 'Eleven Turbo v2.5',
        description: 'Balanced quality and speed',
        latency: '~250ms',
        quality: 'High',
        languages: 32
      },
      {
        model_id: 'eleven_multilingual_v2',
        name: 'Eleven Multilingual v2',
        description: 'Most emotionally-aware model',
        latency: '~300ms',
        quality: 'Highest',
        languages: 29
      }
    ];
  }

  // Validate text for TTS
  validateText(text) {
    if (!text || text.trim().length === 0) {
      return { valid: false, error: 'Empty text provided' };
    }

    // ElevenLabs character limits vary by tier
    const maxLength = 10000; // Conservative limit for free tier
    if (text.length > maxLength) {
      return { 
        valid: false, 
        error: `Text too long (${text.length} chars). Maximum: ${maxLength} characters.` 
      };
    }

    return { valid: true };
  }

  // Check if service is ready
  isReady() {
    return this.isInitialized && this.apiKey !== null;
  }

  // Get supported output formats
  getSupportedFormats() {
    return [
      'mp3_22050_32',
      'mp3_44100_32', 
      'mp3_44100_64',
      'mp3_44100_96',
      'mp3_44100_128',
      'mp3_44100_192',
      'pcm_16000',
      'pcm_22050',
      'pcm_24000',
      'pcm_44100',
      'ulaw_8000'
    ];
  }

  // Clean up resources
  destroy() {
    this.isInitialized = false;
    this.apiKey = null;
  }
}

module.exports = ElevenLabsService;