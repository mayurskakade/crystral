import type { GenerateRequestDto, ProductContextDto } from './dto/generate-request.dto';

function buildProductContextBlock(ctx: ProductContextDto): string {
  return `
## Product Context
- **Name**: ${ctx.name}
- **Tagline**: ${ctx.tagline}
- **Target Audience**: ${ctx.audience}
- **Key Benefits**: ${ctx.benefits?.join(', ') || 'N/A'}
- **Features**: ${ctx.features?.join(', ') || 'N/A'}
- **Pricing**: ${ctx.pricing}
- **CTA**: "${ctx.cta?.label}" → ${ctx.cta?.url}
- **Brand Voice**: ${ctx.voice}
- **Instructions**: ${ctx.instructions}
- **Avoid**: ${ctx.avoid}
- **Power Phrases**: ${ctx.phrases?.join(', ') || 'N/A'}
`.trim();
}

export function buildStaticPrompt(req: GenerateRequestDto): string {
  const count = req.count ?? 4;
  const productBlock = req.productContext
    ? `\n\n${buildProductContextBlock(req.productContext)}\n`
    : '';

  return `You are an expert UI designer specializing in social media ad templates.
${productBlock}
Generate exactly ${count} visually distinct, production-ready static social media ad templates for the following request:

**Request**: ${req.prompt}

## STRICT REQUIREMENTS

### HTML/Tailwind Rules
- Use ONLY Tailwind arbitrary values for colors: \`bg-[#hex]\`, \`text-[#hex]\`, \`border-[#hex]\` (NEVER \`bg-blue-500\` or similar named colors)
- Each template root container MUST use either \`aspect-square\` or \`aspect-video\` class
- Placeholder images: use \`https://picsum.photos/seed/{word}/{width}/{height}\` format
- NO hover/focus/active pseudo-classes
- NO CSS animations or transitions
- Use inline \`style\` attributes only for properties Tailwind cannot express
- Add \`data-field-id="unique-id"\` to every text element (headings, paragraphs, CTAs) for live editing
- Make templates visually rich: use gradients, shadows, layered elements

### JSON Response Format
Return ONLY a valid JSON object with this exact structure:
\`\`\`json
{
  "templates": [
    {
      "name": "Template name",
      "description": "Brief description of style/concept",
      "tags": ["tag1", "tag2", "tag3"],
      "colorPalette": ["#hex1", "#hex2", "#hex3"],
      "previewHtml": "<div class=\\"aspect-square bg-[#1a1a2e] ...\\">...</div>",
      "reactCode": "export function Template() { return (<div className=\\"aspect-square bg-[#1a1a2e] ...\\">...</div>); }"
    }
  ]
}
\`\`\`

Generate ${count} templates with distinct visual styles (e.g., minimalist, bold, gradient, photo-background, typographic).`;
}

export function buildCSSAnimationPrompt(req: GenerateRequestDto): string {
  const count = req.count ?? 4;
  const productBlock = req.productContext
    ? `\n\n${buildProductContextBlock(req.productContext)}\n`
    : '';

  return `You are an expert UI designer specializing in animated social media ad templates.
${productBlock}
Generate exactly ${count} visually distinct, production-ready animated social media ad templates for the following request:

**Request**: ${req.prompt}

## STRICT REQUIREMENTS

### HTML/Tailwind Rules
- Use ONLY Tailwind arbitrary values for colors: \`bg-[#hex]\`, \`text-[#hex]\`, \`border-[#hex]\` (NEVER named colors)
- Each template root container MUST use either \`aspect-square\` or \`aspect-video\` class
- Placeholder images: use \`https://picsum.photos/seed/{word}/{width}/{height}\` format
- NO hover/focus/active pseudo-classes
- Add \`data-field-id="unique-id"\` to every text element for live editing

### Animation Rules
- Include \`<style>\` tag with \`@keyframes\` inside previewHtml
- Total animation loop duration: exactly 5 seconds
- Animated elements MUST start at \`opacity: 0\` and use \`animation-fill-mode: forwards\`
- Use \`animation-delay\` to stagger element entrances (0s, 0.3s, 0.6s, etc.)
- Keep animations smooth: fade-in, slide-up, scale-in, typewriter effects
- Use \`animation-play-state\` friendly names for JS control

### JSON Response Format
Return ONLY a valid JSON object with this exact structure:
\`\`\`json
{
  "templates": [
    {
      "name": "Template name",
      "description": "Brief description of animation style",
      "tags": ["animated", "tag2", "tag3"],
      "colorPalette": ["#hex1", "#hex2", "#hex3"],
      "previewHtml": "<style>@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }</style><div class=\\"aspect-square bg-[#1a1a2e] ...\\">...</div>",
      "reactCode": "export function Template() { return (<><style>{cssString}</style><div className=\\"aspect-square ...\\">...</div></>); }",
      "keyframes": "@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }",
      "animationRules": [
        { "selector": ".headline", "css": "animation: fadeIn 0.8s ease forwards;" },
        { "selector": ".cta", "css": "animation: slideUp 0.6s ease 0.5s forwards; opacity: 0;" }
      ],
      "duration": 5
    }
  ]
}
\`\`\`

Generate ${count} templates with distinct animation styles (e.g., cinematic fade, staggered slide-in, pulse/glow, typewriter, particle-like).`;
}
