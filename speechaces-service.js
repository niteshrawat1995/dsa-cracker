const axios = require('axios');
const FormData = require('form-data');

class SpeechAcesService {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://api.speechace.co/api/scoring';
    this.isInitialized = false;
  }

  initialize(apiKey) {
    if (!apiKey) {
      console.error('SpeechAces API key is required');
      return false;
    }
    
    this.apiKey = apiKey;
    this.isInitialized = true;
    return true;
  }

  async assessPronunciation(audioBuffer, text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('SpeechAces service not initialized. Please check your API key.');
    }

    const {
      dialect = 'en-us',           // Dialect for assessment
      user_id = 'demo_user',       // User identifier
      include_fluency = true,      // Include fluency scoring
      include_pronunciation = true, // Include pronunciation scoring
      include_intonation = false,  // Include intonation analysis
      include_comprehensive = true // Include comprehensive feedback
    } = options;

    try {
      const formData = new FormData();
      
      // audioBuffer is already a Buffer from the renderer process
      
      // Add form fields
      formData.append('key', this.apiKey);
      formData.append('dialect', dialect);
      formData.append('user_id', user_id);
      formData.append('text', text);
      formData.append('user_audio_file', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm'
      });
      
      // Assessment options
      formData.append('include_fluency', include_fluency ? '1' : '0');
      formData.append('include_pronunciation', include_pronunciation ? '1' : '0');
      formData.append('include_intonation', include_intonation ? '1' : '0');
      formData.append('include_comprehensive', include_comprehensive ? '1' : '0');

      const response = await axios.post(
        `${this.baseUrl}/text/v9/json`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Content-Type': 'multipart/form-data'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      return this.parseAssessmentResponse(response.data);

    } catch (error) {
      console.error('SpeechAces assessment error:', error);
      
      let errorMessage = 'Failed to assess pronunciation';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          errorMessage = 'Invalid API key. Please check your SpeechAces configuration.';
        } else if (status === 402) {
          errorMessage = 'SpeechAces quota exceeded. Please check your billing.';
        } else if (status === 413) {
          errorMessage = 'Audio file too large for SpeechAces API.';
        } else if (data && data.error) {
          errorMessage = data.error;
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

  async assessSpontaneousSpeech(audioBuffer, prompt, options = {}) {
    if (!this.isInitialized) {
      throw new Error('SpeechAces service not initialized. Please check your API key.');
    }

    const {
      dialect = 'en-us',
      user_id = 'demo_user',
      include_task_achievement = true,
      include_fluency = true,
      include_pronunciation = true
    } = options;

    try {
      const formData = new FormData();
      // audioBuffer is already a Buffer from the renderer process
      
      formData.append('key', this.apiKey);
      formData.append('dialect', dialect);
      formData.append('user_id', user_id);
      formData.append('question', prompt);
      formData.append('user_audio_file', audioBuffer, {
        filename: 'spontaneous.webm',
        contentType: 'audio/webm'
      });
      
      formData.append('include_task_achievement', include_task_achievement ? '1' : '0');
      formData.append('include_fluency', include_fluency ? '1' : '0');
      formData.append('include_pronunciation', include_pronunciation ? '1' : '0');

      const response = await axios.post(
        `${this.baseUrl}/spontaneous/v9/json`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Content-Type': 'multipart/form-data'
          },
          timeout: 45000 // 45 second timeout for spontaneous speech
        }
      );

      return this.parseSpontaneousResponse(response.data);

    } catch (error) {
      console.error('SpeechAces spontaneous speech error:', error);
      return {
        success: false,
        error: error.message || 'Failed to assess spontaneous speech',
        originalError: error
      };
    }
  }

  parseAssessmentResponse(data) {
    try {
      return {
        success: true,
        overall_score: data.quality_score,
        pronunciation_score: data.pronunciation_score,
        fluency_score: data.fluency_score,
        rhythm_score: data.rhythm_score,
        stress_score: data.stress_score,
        intonation_score: data.intonation_score,
        word_score_list: data.word_score_list || [],
        syllable_score_list: data.syllable_score_list || [],
        phone_score_list: data.phone_score_list || [],
        comprehensive_feedback: data.comprehensive_feedback || null,
        transcription: data.text || null,
        duration: data.duration || null,
        detailed_scores: {
          quality_score: data.quality_score,
          pronunciation_score: data.pronunciation_score,
          fluency_score: data.fluency_score,
          rhythm_score: data.rhythm_score,
          stress_score: data.stress_score,
          pace_score: data.pace_score,
          volume_score: data.volume_score
        },
        feedback_summary: this.generateFeedbackSummary(data)
      };
    } catch (error) {
      console.error('Error parsing assessment response:', error);
      return {
        success: false,
        error: 'Failed to parse assessment results',
        raw_data: data
      };
    }
  }

  parseSpontaneousResponse(data) {
    try {
      return {
        success: true,
        overall_score: data.overall_score,
        task_achievement_score: data.task_achievement_score,
        pronunciation_score: data.pronunciation_score,
        fluency_score: data.fluency_score,
        grammar_score: data.grammar_score,
        vocabulary_score: data.vocabulary_score,
        coherence_score: data.coherence_score,
        transcription: data.transcription || null,
        duration: data.duration || null,
        content_analysis: data.content_analysis || null,
        feedback_summary: this.generateSpontaneousFeedback(data)
      };
    } catch (error) {
      console.error('Error parsing spontaneous response:', error);
      return {
        success: false,
        error: 'Failed to parse spontaneous speech results',
        raw_data: data
      };
    }
  }

  generateFeedbackSummary(data) {
    const feedback = [];
    
    if (data.quality_score) {
      if (data.quality_score >= 80) {
        feedback.push('Excellent overall pronunciation quality!');
      } else if (data.quality_score >= 60) {
        feedback.push('Good pronunciation with room for improvement.');
      } else {
        feedback.push('Pronunciation needs significant improvement.');
      }
    }

    if (data.fluency_score) {
      if (data.fluency_score >= 80) {
        feedback.push('Very fluent speech delivery.');
      } else if (data.fluency_score >= 60) {
        feedback.push('Moderately fluent with some hesitations.');
      } else {
        feedback.push('Work on improving speech fluency.');
      }
    }

    return feedback.join(' ');
  }

  generateSpontaneousFeedback(data) {
    const feedback = [];
    
    if (data.task_achievement_score >= 80) {
      feedback.push('Excellent task completion!');
    } else if (data.task_achievement_score >= 60) {
      feedback.push('Good task completion with minor gaps.');
    } else {
      feedback.push('Focus on addressing the task more completely.');
    }

    return feedback.join(' ');
  }

  // Convert buffer to stream for form data if needed
  bufferToStream(buffer) {
    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }

  // Get supported languages and dialects
  getSupportedDialects() {
    return [
      { code: 'en-us', name: 'English (US)', supported: true },
      { code: 'en-gb', name: 'English (UK)', supported: true },
      { code: 'fr-fr', name: 'French (France)', supported: true },
      { code: 'es-es', name: 'Spanish (Spain)', supported: true },
      { code: 'es-mx', name: 'Spanish (Mexico)', supported: true }
    ];
  }

  // Check if service is ready
  isReady() {
    return this.isInitialized && this.apiKey !== null;
  }

  // Validate audio for SpeechAces
  validateAudio(buffer) {
    if (!buffer || buffer.length === 0) {
      return { valid: false, error: 'Empty audio file' };
    }

    // SpeechAces typical limits (may vary by plan)
    const maxSize = 10 * 1024 * 1024; // 10MB typical limit
    if (buffer.length > maxSize) {
      return { valid: false, error: 'Audio file too large for SpeechAces (max ~10MB)' };
    }

    return { valid: true };
  }

  // Get assessment types
  getAssessmentTypes() {
    return [
      {
        type: 'pronunciation',
        name: 'Pronunciation Assessment',
        description: 'Assess pronunciation accuracy of read text',
        requires_text: true
      },
      {
        type: 'spontaneous',
        name: 'Spontaneous Speech Assessment',
        description: 'Assess fluency and content of spontaneous speech',
        requires_text: false
      }
    ];
  }
}

module.exports = SpeechAcesService;