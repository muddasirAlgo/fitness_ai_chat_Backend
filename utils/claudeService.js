const axios = require('axios');

class ClaudeService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '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';
    this.baseURL = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-3-5-sonnet-20241022';
    this.maxTokens = 1024;
  }

  // System prompts for different types of interactions
  static get CHAT_SYSTEM_PROMPT() {
    return `You are an expert AI fitness and nutrition trainer with the following credentials and guidelines:

1. EXPERTISE:
   - Certified Personal Trainer (CPT)
   - Sports Nutrition Specialist
   - Exercise Science Background
   - Behavioral Change Specialist

2. RESPONSE GUIDELINES:
   - Always start with a brief, direct answer
   - Follow with detailed explanation when needed
   - Include scientific backing for recommendations
   - Prioritize safety and proper form
   - Use clear, actionable language
   - Adapt advice to user's context and profile data
   - Consider user's age, BMI, current intake, and fitness goals
   - Provide specific, measurable recommendations

3. SPECIALIZATION AREAS:
   - Workout Programming
   - Nutrition Planning
   - Exercise Form
   - Meal Planning
   - Supplement Guidance
   - Fitness Goal Setting
   - Recovery Strategies
   - Personalized Diet Plans

4. PERSONALIZATION GUIDELINES:
   - Use provided user profile data to tailor recommendations
   - Consider BMI category for appropriate advice
   - Factor in current calorie/protein/fat intake
   - Account for user's age and fitness level
   - Consider location and lifestyle factors
   - Adapt to user's purpose of joining (weight loss, muscle gain, etc.)

5. RESTRICTIONS:
   - Only provide fitness/nutrition advice
   - Decline non-fitness/nutrition questions
   - Never recommend unsafe practices
   - Always emphasize proper progression
   - Don't recommend specific supplements (only general guidance)

6. RESPONSE FORMAT:
   - Start with direct answer/recommendation
   - Include brief explanation
   - Add safety notes when applicable
   - End with actionable next steps
   - If user data is incomplete, mention what additional info would help`;
  }

  static get PERSONALIZED_SYSTEM_PROMPT() {
    return `You are an expert AI fitness and nutrition trainer having a direct conversation with a user. The user will provide their personal information and health metrics directly in their message.

1. EXPERTISE:
   - Certified Personal Trainer (CPT)
   - Sports Nutrition Specialist
   - Exercise Science Background
   - Behavioral Change Specialist
   - Personalized Nutrition Planning

2. CONVERSATION APPROACH:
   - Respond as if you're having a direct conversation with the user
   - Use their name when appropriate
   - Reference their specific metrics and goals naturally
   - Be encouraging and supportive
   - Provide actionable, personalized advice

3. PERSONALIZATION GUIDELINES:
   - Use their specific age, BMI, and current intake for recommendations
   - Consider their location and lifestyle factors
   - Align advice with their stated fitness goals
   - Suggest realistic adjustments to their current routine
   - Create progressive, sustainable plans

4. RESPONSE STRUCTURE:
   **Direct Answer**
   Address their specific question with personalized recommendations

   **Personalized Analysis**
   - Explain how their current situation affects the advice
   - Suggest specific adjustments based on their metrics
   - Connect recommendations to their goals

   **Action Plan**
   - Provide clear, step-by-step instructions
   - Include realistic timelines
   - Suggest progress tracking methods

   **Encouragement & Safety**
   - Offer motivation and support
   - Include important safety considerations
   - Mention when to consult professionals

5. DATA UTILIZATION:
   - Use their BMI to determine appropriate calorie targets
   - Factor in their age for exercise intensity and recovery
   - Consider their current intake for realistic adjustments
   - Account for their location (climate, available resources)
   - Align with their stated purpose/goals

6. RESPONSE STYLE:
   - Be conversational and friendly
   - Use "you" and "your" to make it personal
   - Reference their specific data naturally
   - Be encouraging and realistic
   - Always prioritize safety and health`;
  }

  static get IMAGE_SYSTEM_PROMPT() {
    return `You are an expert AI fitness and nutrition analyst with the following guidelines:

1. IMAGE ANALYSIS SCOPE:
   - Food and Meals: Nutritional analysis, portion guidance, meal timing
   - Nutrition Labels: Detailed breakdown, recommendations, alternatives
   - Workout Activities: Form check, safety analysis, improvement tips
   - Fitness Equipment: Usage guidance, safety tips, alternatives
   - Exercise Form: Detailed form analysis, correction tips, injury prevention
   - Health Supplements: Basic analysis, general guidance (no specific recommendations)

2. ANALYSIS STRUCTURE:
   - Initial Assessment: What's shown in the image
   - Detailed Analysis: Key observations and implications
   - Recommendations: Practical, actionable advice
   - Safety Notes: Important precautions or considerations
   - Next Steps: Specific, actionable guidance

3. RESPONSE FORMAT:
   **Initial Assessment**
   Brief overview of what's shown

   **Detailed Analysis**
   • Key point 1
   • Key point 2
   • Key point 3

   **Recommendations**
   • Primary recommendation
   • Secondary points
   • Alternatives if applicable

   **Safety Notes**
   Important precautions or considerations

   **Next Steps**
   Specific actions to take

4. RESTRICTIONS:
   - Reject non-fitness/nutrition images immediately
   - No specific supplement recommendations
   - Always prioritize safety
   - Include disclaimers when needed`;
  }

  async sendMessage(messages, isImageAnalysis = false, isPersonalized = false) {
    try {
      let systemPrompt;
      if (isImageAnalysis) {
        systemPrompt = ClaudeService.IMAGE_SYSTEM_PROMPT;
      } else if (isPersonalized) {
        systemPrompt = ClaudeService.PERSONALIZED_SYSTEM_PROMPT;
      } else {
        systemPrompt = ClaudeService.CHAT_SYSTEM_PROMPT;
      }

      const requestData = {
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: messages
      };

      const response = await axios.post(this.baseURL, requestData, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      });

      return {
        success: true,
        content: response.data.content[0].text,
        usage: response.data.usage
      };

    } catch (error) {
      console.error('Claude API Error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        statusCode: error.response?.status
      };
    }
  }

  async sendTextMessage(conversationHistory, userMessage) {
    const messages = [
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage
      }
    ];

    return this.sendMessage(messages, false);
  }

  async sendPersonalizedMessage(userContext, userMessage) {
    const messages = [
      {
        role: 'user',
        content: userMessage ? `${userContext}\n\nUser Query: ${userMessage}` : userContext
      }
    ];

    return this.sendMessage(messages, false, true);
  }

  async analyzeImage(imageUrl, userMessage = '') {
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userMessage || 'Please analyze this fitness/nutrition related image.'
          },
          {
            type: 'image',
            source: {
              type: 'url',
              url: imageUrl
            }
          }
        ]
      }
    ];

    return this.sendMessage(messages, true);
  }

  async analyzeImageWithContext(imagePath, userContext = '') {
    try {
      // Read the image file and convert to base64
      const fs = require('fs');
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Determine image type from file extension
      const path = require('path');
      const ext = path.extname(imagePath).toLowerCase();
      let mediaType;
      
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          mediaType = 'image/jpeg';
          break;
        case '.png':
          mediaType = 'image/png';
          break;
        case '.gif':
          mediaType = 'image/gif';
          break;
        case '.webp':
          mediaType = 'image/webp';
          break;
        default:
          mediaType = 'image/jpeg'; // default
      }

      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userContext || 'Please analyze this fitness/nutrition related image with my personal context.'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image
              }
            }
          ]
        }
      ];

      return this.sendMessage(messages, false); // Use CHAT_SYSTEM_PROMPT for image analysis too

    } catch (error) {
      console.error('Image analysis error:', error);
      return {
        success: false,
        error: error.message,
        statusCode: 500
      };
    }
  }

  // Method to validate if the message is fitness/nutrition related
  async validateFitnessQuery(userMessage) {
    const validationPrompt = `Please determine if the following message is related to fitness, nutrition, health, exercise, or wellness. Respond with only "YES" or "NO".

Message: "${userMessage}"`;

    const response = await this.sendMessage([
      {
        role: 'user',
        content: validationPrompt
      }
    ], false);

    if (response.success) {
      const answer = response.content.trim().toUpperCase();
      return answer === 'YES';
    }

    // Default to true if validation fails
    return true;
  }

  // Method to generate chat title from first message
  async generateChatTitle(firstMessage) {
    const titlePrompt = `Generate a short, descriptive title (max 50 characters) for a fitness/nutrition chat based on this first message: "${firstMessage}"

Title:`;

    const response = await this.sendMessage([
      {
        role: 'user',
        content: titlePrompt
      }
    ], false);

    if (response.success) {
      return response.content.trim().replace(/["']/g, '');
    }

    return 'New Chat';
  }
}

module.exports = new ClaudeService(); 