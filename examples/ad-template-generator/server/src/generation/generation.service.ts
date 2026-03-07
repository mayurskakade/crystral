import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleProvider, withRetry, Logger, hashCacheKey } from '@crystralai/core';
import { buildStaticPrompt, buildCSSAnimationPrompt } from './prompt-builder';
import { postProcess } from './post-processor';
import type { GenerateRequestDto } from './dto/generate-request.dto';
import type { Template, RawTemplate } from './dto/template.dto';

interface CacheEntry {
  data: Template[];
  expiresAt: number;
}

@Injectable()
export class GenerationService {
  private provider: GoogleProvider;
  private logger: Logger;
  private memCache: Map<string, CacheEntry> = new Map();

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    this.provider = new GoogleProvider(apiKey);
    this.logger = Logger.getInstance({ level: 'info', trace: false, export: 'stdout' });
  }

  async generate(req: GenerateRequestDto): Promise<Template[]> {
    const cacheKey = hashCacheKey({
      prompt: req.prompt,
      type: req.type,
      count: req.count,
      productContext: req.productContext,
    });

    const cached = this.memCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.info('Cache hit', { cacheKey });
      return cached.data;
    }

    const prompt =
      req.type === 'static'
        ? buildStaticPrompt(req)
        : buildCSSAnimationPrompt(req);

    const model = 'gemini-2.5-pro';
    this.logger.info('Calling Gemini', { model, type: req.type });
    const t0 = Date.now();

    const completionOpts: Record<string, unknown> = {
      response_format: { type: 'json_object' },
      max_tokens: 8192,
      temperature: 0.9,
    };

    if (req.referenceImageBase64) {
      completionOpts['images'] = [
        {
          data: req.referenceImageBase64,
          media_type: req.referenceImageMimeType ?? 'image/jpeg',
        },
      ];
    }

    const msg = { id: 'msg-1', role: 'user' as const, content: prompt, created_at: new Date().toISOString() };
    const result = await withRetry(
      () =>
        this.provider.complete(
          [msg],
          model,
          completionOpts as never,
        ),
      { max_attempts: 3, backoff: 'exponential', retry_on: ['rate_limit', 'server_error'] },
    );

    this.logger.info('Gemini response received', { latencyMs: Date.now() - t0 });

    let parsed: RawTemplate[];
    try {
      // Strip markdown code fences that Gemini 2.5 (thinking mode) sometimes adds
      let text = result.content.trim();
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) text = fenceMatch[1].trim();
      const body = JSON.parse(text) as { templates: RawTemplate[] };
      if (!Array.isArray(body.templates)) throw new Error('missing templates array');
      parsed = body.templates;
    } catch (err) {
      this.logger.error('JSON parse failed', { content: result.content.slice(0, 200) });
      throw new Error(`Gemini returned malformed JSON: ${err instanceof Error ? err.message : 'parse error'}`);
    }

    const templates = postProcess(parsed, req);

    this.memCache.set(cacheKey, {
      data: templates,
      expiresAt: Date.now() + 3600 * 1000,
    });

    return templates;
  }

  async validateKey(apiKey: string): Promise<void> {
    const provider = new GoogleProvider(apiKey);
    const ping = { id: 'ping', role: 'user' as const, content: 'Say OK', created_at: new Date().toISOString() };
    await provider.complete([ping], 'gemini-2.0-flash', { max_tokens: 10 });
  }
}
