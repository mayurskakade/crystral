'use client';

import { useState, useRef, useCallback } from 'react';
import type { Template } from '@/types/template';
import { swapColor, swapText } from '@/lib/editor';
import { ExportPanel } from './ExportPanel';

interface Props {
  template: Template;
  onUpdate: (t: Template) => void;
}

export function TemplateEditor({ template, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<'colors' | 'text' | 'export'>('colors');
  const previewRef = useRef<HTMLDivElement>(null);

  const updateHtml = useCallback(
    (newHtml: string) => onUpdate({ ...template, previewHtml: newHtml }),
    [template, onUpdate],
  );

  function handleColorChange(oldHex: string, newHex: string) {
    const newHtml = swapColor(template.previewHtml, oldHex, newHex);
    const newPalette = template.colorPalette.map(c =>
      c.toLowerCase() === oldHex.toLowerCase() ? newHex : c,
    );
    onUpdate({ ...template, previewHtml: newHtml, colorPalette: newPalette });
  }

  // Extract text fields from data-field-id attributes
  const re = /data-field-id="([^"]+)"[^>]*>([^<]*)</g;
  const fieldMatches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(template.previewHtml)) !== null) fieldMatches.push(m);
  const textFields = fieldMatches.map(m => ({ id: m[1], value: m[2] }));

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Live preview */}
      <div className="relative bg-gray-950 rounded-xl overflow-hidden" ref={previewRef}>
        <iframe
          srcDoc={`<!DOCTYPE html><html><head>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}
            body{display:flex;align-items:center;justify-content:center;background:#000;}</style>
          </head><body>${template.previewHtml}</body></html>`}
          className="w-full aspect-square border-none"
          sandbox="allow-scripts"
          title="Live preview"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
        {(['colors', 'text', 'export'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'colors' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Color Palette</p>
            {template.colorPalette.map((hex, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="color"
                  value={hex}
                  onChange={e => handleColorChange(hex, e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <div>
                  <p className="text-sm text-white font-mono">{hex}</p>
                  <p className="text-xs text-gray-500">Color {i + 1}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Editable Text</p>
            {textFields.length === 0 && (
              <p className="text-sm text-gray-500">No editable text fields found in this template.</p>
            )}
            {textFields.map(f => (
              <div key={f.id}>
                <label className="block text-xs text-gray-500 mb-1 capitalize">
                  {f.id.replace(/-/g, ' ')}
                </label>
                <input
                  defaultValue={f.value}
                  onChange={e => updateHtml(swapText(template.previewHtml, f.id, e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'export' && (
          <ExportPanel template={template} previewRef={previewRef} />
        )}
      </div>
    </div>
  );
}
