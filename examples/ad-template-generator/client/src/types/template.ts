export interface Template {
  id: string;
  type: 'static' | 'animation';
  name: string;
  description: string;
  tags: string[];
  colorPalette: string[];
  previewHtml: string;
  reactCode: string;
  animationConfig?: AnimationConfig;
  productSnapshot?: ProductContext;
}

export interface AnimationConfig {
  keyframes: string;
  animationRules: { selector: string; css: string }[];
  duration: number;
}

export interface ProductContext {
  name: string;
  tagline: string;
  audience: string;
  benefits: string[];
  features: string[];
  pricing: string;
  cta: { label: string; url: string };
  voice: string;
  instructions: string;
  avoid: string;
  phrases: string[];
}

export interface BrandKit {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl?: string;
}

export interface GenerateRequest {
  prompt: string;
  type: 'static' | 'animation';
  count?: number;
  productContext?: ProductContext;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
}
