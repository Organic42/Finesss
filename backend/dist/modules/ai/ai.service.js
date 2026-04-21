"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = __importDefault(require("openai"));
const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';
const SYSTEM_PROMPT = `You are FinBot, the financial co-pilot inside the FinEase dashboard for MSMEs.
You are given the user's live KPI + forecast snapshot as JSON context with every turn.
Always ground your answers in that context; if a figure isn't present, say so rather than guessing.
Be concise, practical, and action-oriented. Use short paragraphs and at most a couple of bullet points.
Prefer concrete recommendations ("Trim expense by 5% next quarter") over generic advice.
Format numbers with thousand separators and the user's currency when possible.`;
let AiService = AiService_1 = class AiService {
    config;
    logger = new common_1.Logger(AiService_1.name);
    client = null;
    constructor(config) {
        this.config = config;
    }
    getClient() {
        if (this.client)
            return this.client;
        const key = this.config.get('GROQ_API_KEY');
        if (!key) {
            throw new common_1.ServiceUnavailableException('GROQ_API_KEY is not configured in the backend .env file.');
        }
        this.client = new openai_1.default({
            apiKey: key,
            baseURL: 'https://api.groq.com/openai/v1',
        });
        return this.client;
    }
    async chat(message, context) {
        const client = this.getClient();
        const contextBlock = context
            ? `\n\nCURRENT USER CONTEXT (JSON):\n${JSON.stringify(context).slice(0, 8000)}`
            : '';
        const fullSystemPrompt = `${SYSTEM_PROMPT}${contextBlock}`;
        try {
            return await this.generate(client, PRIMARY_MODEL, fullSystemPrompt, message);
        }
        catch (err) {
            if (this.shouldFallback(err)) {
                this.logger.warn(`Primary model ${PRIMARY_MODEL} failed (${describeError(err)}); falling back to ${FALLBACK_MODEL}`);
                try {
                    return await this.generate(client, FALLBACK_MODEL, fullSystemPrompt, message);
                }
                catch (fallbackErr) {
                    this.logger.error(`Fallback model ${FALLBACK_MODEL} also failed: ${describeError(fallbackErr)}`);
                    throw new common_1.InternalServerErrorException(`Both Groq models failed: ${describeError(fallbackErr)}`);
                }
            }
            this.logger.error(`Groq API call failed: ${describeError(err)}`);
            throw new common_1.InternalServerErrorException(`Groq API call failed: ${describeError(err)}`);
        }
    }
    async generate(client, modelName, systemContent, userContent) {
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
    shouldFallback(err) {
        const msg = describeError(err).toLowerCase();
        return (msg.includes('429') ||
            msg.includes('quota') ||
            msg.includes('rate') ||
            msg.includes('unavailable') ||
            msg.includes('overloaded') ||
            msg.includes('503') ||
            msg.includes('500'));
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
function describeError(err) {
    if (err instanceof Error)
        return err.message;
    try {
        return JSON.stringify(err);
    }
    catch {
        return String(err);
    }
}
//# sourceMappingURL=ai.service.js.map