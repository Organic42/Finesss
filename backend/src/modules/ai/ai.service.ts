import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// Groq uses high-speed open-source models. Llama 3 is perfect here.
const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are FinBot, the financial co-pilot inside the FinEase dashboard for MSMEs.
You are given the user's live KPI + forecast snapshot as JSON context with every turn.
Always ground your answers in that context; if a figure isn't present, say so rather than guessing.
Be concise, practical, and action-oriented. Use short paragraphs and at most a couple of bullet points.
Prefer concrete recommendations ("Trim expense by 5% next quarter") over generic advice.
Format numbers with thousand separators and the user's currency when possible.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): OpenAI {
    if (this.client) return this.client;
    
    const key = this.config.get<string>('GROQ_API_KEY');
    
    if (!key) {
      throw new ServiceUnavailableException(
        'GROQ_API_KEY is not configured in the backend .env file.',
      );
    }
    
    // Connect to Groq using the OpenAI SDK by overriding the baseURL
    this.client = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    
    return this.client;
  }

  async chat(message: string, context?: Record<string, unknown>) {
    const client = this.getClient();
    const contextBlock = context
      ? `\n\nCURRENT USER CONTEXT (JSON):\n${JSON.stringify(context).slice(0, 8000)}`
      : '';
    
    const fullSystemPrompt = `${SYSTEM_PROMPT}${contextBlock}`;

    try {
      return await this.generate(client, PRIMARY_MODEL, fullSystemPrompt, message);
    } catch (err) {
      if (this.shouldFallback(err)) {
        this.logger.warn(
          `Primary model ${PRIMARY_MODEL} failed (${describeError(err)}); falling back to ${FALLBACK_MODEL}`,
        );
        try {
          return await this.generate(client, FALLBACK_MODEL, fullSystemPrompt, message);
        } catch (fallbackErr) {
          this.logger.error(
            `Fallback model ${FALLBACK_MODEL} also failed: ${describeError(fallbackErr)}`,
          );
          throw new InternalServerErrorException(
            `Both Groq models failed: ${describeError(fallbackErr)}`,
          );
        }
      }
      this.logger.error(`Groq API call failed: ${describeError(err)}`);
      throw new InternalServerErrorException(
        `Groq API call failed: ${describeError(err)}`,
      );
    }
  }

  private async generate(
    client: OpenAI,
    modelName: string,
    systemContent: string,
    userContent: string,
  ) {
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent }
      ],
    });
    
    const reply = response.choices[0]?.message?.content?.trim() || 'No response generated.';
    return { reply, model: modelName };
  }

  private shouldFallback(err: unknown): boolean {
    const msg = describeError(err).toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('quota') ||
      msg.includes('rate') ||
      msg.includes('unavailable') ||
      msg.includes('overloaded') ||
      msg.includes('503') ||
      msg.includes('500')
    );
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}