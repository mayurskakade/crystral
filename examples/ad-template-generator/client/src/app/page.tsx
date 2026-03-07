'use client';

import { useState } from 'react';
import type { Template, GenerateRequest } from '@/types/template';
import { generateTemplates } from '@/lib/api';
import { GenerateForm } from '@/components/GenerateForm';
import { TemplateGallery } from '@/components/TemplateGallery';
import { TemplateEditor } from '@/components/TemplateEditor';
import { BrandKitPanel } from '@/components/BrandKitPanel';

export default function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(req: GenerateRequest) {
    setLoading(true);
    setError(null);
    try {
      const result = await generateTemplates(req);
      setTemplates(prev => [...result, ...prev]);
      if (result.length > 0) setSelected(result[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(t: Template) {
    setSelected(t);
  }

  function handleUpdateTemplate(updated: Template) {
    setTemplates(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setSelected(updated);
  }

  function handleBrandKitApply(updated: Template[]) {
    setTemplates(updated);
    if (selected) {
      const u = updated.find(t => t.id === selected.id);
      if (u) setSelected(u);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Ad Template Generator</h1>
            <p className="text-xs text-gray-500">Powered by Crystal AI + Gemini</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500">Gemini 2.5 Pro</span>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto flex h-[calc(100vh-65px)]">
        {/* Left sidebar — Generate form + Brand kit */}
        <aside className="w-80 border-r border-white/10 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-white/10">
            <GenerateForm onGenerate={handleGenerate} loading={loading} />
            {error && (
              <div className="mt-3 text-sm text-red-400 bg-red-900/20 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>

          <div className="p-4">
            <BrandKitPanel templates={templates} onApply={handleBrandKitApply} />
          </div>
        </aside>

        {/* Center — Template gallery */}
        <main className="flex-1 overflow-y-auto p-4">
          {loading && templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Generating templates with Gemini...</p>
            </div>
          ) : (
            <>
              {templates.length > 0 && (
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-400">
                    {templates.length} template{templates.length !== 1 ? 's' : ''} generated
                  </p>
                  <button
                    onClick={() => { setTemplates([]); setSelected(null); }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear all
                  </button>
                </div>
              )}
              <TemplateGallery
                templates={templates}
                onSelect={handleSelect}
                selectedId={selected?.id}
              />
            </>
          )}
        </main>

        {/* Right sidebar — Template editor */}
        {selected && (
          <aside className="w-80 border-l border-white/10 overflow-y-auto p-4">
            <div className="mb-3">
              <h2 className="text-sm font-medium">{selected.name}</h2>
              <p className="text-xs text-gray-500">{selected.description}</p>
            </div>
            <TemplateEditor
              template={selected}
              onUpdate={handleUpdateTemplate}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
