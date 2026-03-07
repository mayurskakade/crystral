import { IsString, IsIn, IsOptional, IsNumber, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductContextDto {
  @IsString() name: string;
  @IsString() tagline: string;
  @IsString() audience: string;
  benefits: string[];
  features: string[];
  @IsString() pricing: string;
  cta: { label: string; url: string };
  @IsString() voice: string;
  @IsString() instructions: string;
  @IsString() avoid: string;
  phrases: string[];
}

export class GenerateRequestDto {
  @IsString()
  prompt: string;

  @IsIn(['static', 'animation'])
  type: 'static' | 'animation';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8)
  @Type(() => Number)
  count?: number;

  @IsOptional()
  @IsObject()
  @Type(() => ProductContextDto)
  productContext?: ProductContextDto;

  @IsOptional()
  @IsString()
  referenceImageBase64?: string;

  @IsOptional()
  @IsString()
  referenceImageMimeType?: string;
}
