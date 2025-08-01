const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
  }

  initialize(apiKey) {
    try {
      this.client = new OpenAI({
        apiKey: apiKey
      });
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error);
      this.isInitialized = false;
      return false;
    }
  }

  async generateResponse(userInput, options = {}) {
    if (!this.isInitialized || !this.client) {
      throw new Error('OpenAI client not initialized. Please check your API key.');
    }

    const {
      model = 'gpt-4',
      maxTokens = 6000,
      temperature = 0.7,
      systemPrompt = 'You are a helpful assistant. Provide concise and relevant responses.'
    } = options;

    try {
      const completion = await this.client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        max_tokens: maxTokens,
        temperature: temperature,
        stream: false
      });

      if (completion.choices && completion.choices.length > 0) {
        return {
          success: true,
          response: completion.choices[0].message.content.trim(),
          usage: completion.usage
        };
      } else {
        throw new Error('No response generated from OpenAI');
      }
    } catch (error) {
      console.error('OpenAI API Error:', error);
      
      let errorMessage = 'Failed to get AI response';
      
      if (error.code === 'insufficient_quota') {
        errorMessage = 'API quota exceeded. Please check your billing.';
      } else if (error.code === 'invalid_api_key') {
        errorMessage = 'Invalid API key. Please check your configuration.';
      } else if (error.code === 'rate_limit_exceeded') {
        errorMessage = 'Rate limit exceeded. Please try again later.';
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

  async generateStreamResponse(userInput, onChunk, options = {}) {
    if (!this.isInitialized || !this.client) {
      throw new Error('OpenAI client not initialized. Please check your API key.');
    }

    const {
      model = 'gpt-3.5-turbo',
      maxTokens = 150,
      temperature = 0.7,
      systemPrompt = 'You are a helpful assistant. Provide concise and relevant responses.'
    } = options;

    try {
      const stream = await this.client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        max_tokens: maxTokens,
        temperature: temperature,
        stream: true
      });

      let fullResponse = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          if (onChunk) {
            onChunk(content, fullResponse);
          }
        }
      }

      return {
        success: true,
        response: fullResponse
      };
    } catch (error) {
      console.error('OpenAI Streaming Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to stream AI response'
      };
    }
  }

  isReady() {
    return this.isInitialized && this.client !== null;
  }
}

module.exports = OpenAIService;