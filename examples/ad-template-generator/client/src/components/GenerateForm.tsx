'use client';

import { useState, useRef } from 'react';
import type { GenerateRequest, ProductContext } from '@/types/template';

interface Props {
  onGenerate: (req: GenerateRequest) => void;
  loading: boolean;
}

const emptyProduct = (): ProductContext => ({
  name: '', tagline: '', audience: '', benefits: [], features: [],
  pricing: '', cta: { label: 'Get Started', url: '#' },
  voice: '', instructions: '', avoid: '', phrases: [],
});

export function GenerateForm({ onGenerate, loading }: Props) {
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState<'static' | 'animation'>('static');
  const [count, setCount] = useState(4);
  const [showProduct, setShowProduct] = useState(false);
  const [product, setProduct] = useState<ProductContext>(emptyProduct());
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imageMime, setImageMime] = useState<string | undefined>();
  const [imagePreview, setImagePreview] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleImageChange(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      const [header, base64] = dataUrl.split(',');
      const mime = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
      setImageBase64(base64);
      setImageMime(mime);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageChange(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    onGenerate({
      prompt,
      type,
      count,
      productContext: showProduct ? product : undefined,
      referenceImageBase64: imageBase64,
      referenceImageMimeType: imageMime,
    } as GenerateRequest);
  }

  function updateProduct(key: keyof ProductContext, value: unknown) {
    setProduct(p => ({ ...p, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type toggle */}
      <div className="flex gap-2">
        {(['static', 'animation'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              type === t
                ? 'bg-violet-600 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            {t === 'static' ? 'Static' : 'Animated'}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-400">Count</label>
          <select
            value={count}
            onChange={e => setCount(Number(e.target.value))}
            className="bg-white/10 text-white rounded px-2 py-1 text-sm"
          >
            {[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Prompt */}
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Describe your ad template... (e.g. 'Luxury watch brand launch, dark moody aesthetic')"
        rows={3}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none"
      />

      {/* Reference image upload */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="border border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer hover:border-violet-500 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {imagePreview ? (
          <div className="flex items-center gap-3">
            <img src={imagePreview} alt="Reference" className="h-16 w-16 object-cover rounded" />
            <div className="text-left">
              <p className="text-sm text-white">Reference image attached</p>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setImageBase64(undefined); setImageMime(undefined); setImagePreview(undefined); }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Drop reference image here or click to upload</p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleImageChange(e.target.files[0]); }}
        />
      </div>

      {/* Product context */}
      <details open={showProduct} onToggle={e => setShowProduct((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-sm text-gray-400 hover:text-white select-none">
          Product Context (optional)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { key: 'name', label: 'Product Name', placeholder: 'Acme Pro' },
            { key: 'tagline', label: 'Tagline', placeholder: 'Work smarter, not harder' },
            { key: 'audience', label: 'Target Audience', placeholder: 'Founders & PMs' },
            { key: 'pricing', label: 'Pricing', placeholder: '$49/mo' },
            { key: 'voice', label: 'Brand Voice', placeholder: 'Bold, innovative' },
            { key: 'avoid', label: 'Avoid', placeholder: 'Corporate speak' },
          ].map(f => (
            <div key={f.key} className={f.key === 'tagline' || f.key === 'voice' || f.key === 'avoid' ? 'col-span-2' : ''}>
              <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
              <input
                value={(product as unknown as Record<string, string>)[f.key]}
                onChange={e => updateProduct(f.key as keyof ProductContext, e.target.value)}
                placeholder={f.placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Instructions</label>
            <textarea
              value={product.instructions}
              onChange={e => updateProduct('instructions', e.target.value)}
              placeholder="Specific instructions for the AI..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">CTA Label</label>
            <input
              value={product.cta.label}
              onChange={e => updateProduct('cta', { ...product.cta, label: e.target.value })}
              placeholder="Get Started"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">CTA URL</label>
            <input
              value={product.cta.url}
              onChange={e => updateProduct('cta', { ...product.cta, url: e.target.value })}
              placeholder="https://example.com"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>
      </details>

      <button
        type="submit"
        disabled={loading || !prompt.trim()}
        className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating templates...
          </span>
        ) : (
          'Generate Templates'
        )}
      </button>
    </form>
  );
}
