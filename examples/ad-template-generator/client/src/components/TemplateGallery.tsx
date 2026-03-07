'use client';

import type { Template } from '@/types/template';

interface Props {
  templates: Template[];
  onSelect: (t: Template) => void;
  selectedId?: string;
}

export function TemplateGallery({ templates, onSelect, selectedId }: Props) {
  if (templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-600">
        No templates yet — generate some above
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {templates.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className={`group relative text-left rounded-xl overflow-hidden border transition-all ${
            selectedId === t.id
              ? 'border-violet-500 ring-2 ring-violet-500/30'
              : 'border-white/10 hover:border-white/30'
          }`}
        >
          {/* Template preview (rendered HTML via Tailwind CDN iframe) */}
          <TemplatePreviewMini html={t.previewHtml} />

          {/* Overlay info */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
            <p className="text-white text-sm font-medium">{t.name}</p>
            <p className="text-gray-400 text-xs">{t.description}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {t.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Selected badge */}
          {selectedId === t.id && (
            <div className="absolute top-2 right-2 bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full">
              Editing
            </div>
          )}

          {/* Type badge */}
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
            {t.type}
          </div>
        </button>
      ))}
    </div>
  );
}

function TemplatePreviewMini({ html }: { html: string }) {
  return (
    <div className="w-full aspect-square bg-gray-900 overflow-hidden">
      <iframe
        srcDoc={`<!DOCTYPE html><html><head>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}
          body{display:flex;align-items:center;justify-content:center;}</style>
        </head><body>${html}</body></html>`}
        className="w-full h-full border-none scale-[0.5] origin-top-left"
        style={{ width: '200%', height: '200%', transform: 'scale(0.5)', transformOrigin: '0 0' }}
        sandbox="allow-scripts"
        title="Template preview"
      />
    </div>
  );
}
