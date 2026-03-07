export interface AnimationConfig {
  keyframes: string;
  animationRules: { selector: string; css: string }[];
  duration: number;
}

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
  productSnapshot?: Record<string, unknown>;
}

export interface RawTemplate {
  name: string;
  description: string;
  tags: string[];
  colorPalette: string[];
  previewHtml: string;
  reactCode: string;
  // animation-only fields
  keyframes?: string;
  animationRules?: { selector: string; css: string }[];
  duration?: number;
}
