import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GenerationService } from './generation.service';
import { GenerateRequestDto } from './dto/generate-request.dto';

@Controller('api')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image'))
  async generate(
    @Body() body: Record<string, string>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const req = new GenerateRequestDto();
    req.prompt = body['prompt'];
    req.type = body['type'] as 'static' | 'animation';
    req.count = body['count'] ? Number(body['count']) : 4;

    if (!req.prompt) throw new BadRequestException('prompt is required');
    if (!['static', 'animation'].includes(req.type)) {
      throw new BadRequestException('type must be static or animation');
    }

    if (body['productContext']) {
      try {
        req.productContext = JSON.parse(body['productContext']);
      } catch {
        throw new BadRequestException('productContext must be valid JSON');
      }
    }

    if (file) {
      req.referenceImageBase64 = file.buffer.toString('base64');
      req.referenceImageMimeType = file.mimetype;
    }

    try {
      const templates = await this.generationService.generate(req);
      return { templates };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('validate-key')
  @HttpCode(HttpStatus.OK)
  async validateKey(@Body() body: { apiKey: string }) {
    if (!body.apiKey) throw new BadRequestException('apiKey is required');

    try {
      await this.generationService.validateKey(body.apiKey);
      return { valid: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { valid: false, error: message };
    }
  }
}
