import type { GenerateRequestDto } from './dto/generate-request.dto';
import type { RawTemplate, Template } from './dto/template.dto';

export function postProcess(raw: RawTemplate[], req: GenerateRequestDto): Template[] {
  return raw.map((t, i) => ({
    id: `template-${Date.now()}-${i}`,
    type: req.type,
    name: t.name,
    description: t.description,
    tags: t.tags ?? [],
    colorPalette: t.colorPalette ?? [],
    previewHtml: t.previewHtml,
    reactCode: t.reactCode,
    animationConfig:
      req.type === 'animation' && t.keyframes
        ? {
            keyframes: t.keyframes,
            animationRules: t.animationRules ?? [],
            duration: t.duration ?? 5,
          }
        : undefined,
    productSnapshot: req.productContext
      ? (req.productContext as unknown as Record<string, unknown>)
      : undefined,
  }));
}
