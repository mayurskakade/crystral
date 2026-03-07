'use client';

import { useState } from 'react';
import type { BrandKit, Template } from '@/types/template';
import { applyBrandKit } from '@/lib/editor';

interface Props {
  templates: Template[];
  onApply: (updated: Template[]) => void;
}

const WEB_FONTS = [
  'Inter', 'Roboto', 'Poppins', 'Playfair Display', 'Montserrat',
  'DM Sans', 'Space Grotesk', 'Sora', 'Plus Jakarta Sans', 'Outfit',
];

const defaultKit: BrandKit = {
  primaryColor: '#7c3aed',
  secondaryColor: '#1e1b4b',
  accentColor: '#f59e0b',
  fontFamily: 'Inter',
};

export function BrandKitPanel({ templates, onApply }: Props) {
  const [kit, setKit] = useState<BrandKit>(defaultKit);

  function update<K extends keyof BrandKit>(key: K, value: BrandKit[K]) {
    setKit(prev => ({ ...prev, [key]: value }));
  }

  function applyToAll() {
    const updated = templates.map(t => ({
      ...t,
      previewHtml: applyBrandKit(t.previewHtml, t.colorPalette, kit),
      colorPalette: [kit.primaryColor, kit.secondaryColor, kit.accentColor],
    }));
    onApply(updated);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">Brand Kit</p>

      <div className="space-y-3">
        {(
          [
            { key: 'primaryColor', label: 'Primary' },
            { key: 'secondaryColor', label: 'Secondary' },
            { key: 'accentColor', label: 'Accent' },
          ] as { key: keyof BrandKit; label: string }[]
        ).map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <input
              type="color"
              value={kit[key] as string}
              onChange={e => update(key, e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
            />
            <div className="flex-1">
              <p className="text-sm text-white">{label}</p>
              <p className="text-xs text-gray-500 font-mono">{kit[key] as string}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Font Family</label>
        <select
          value={kit.fontFamily}
          onChange={e => update('fontFamily', e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
        >
          {WEB_FONTS.map(f => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={applyToAll}
        disabled={templates.length === 0}
        className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
      >
        Apply to All Templates
      </button>

      {templates.length === 0 && (
        <p className="text-xs text-gray-600 text-center">Generate templates first</p>
      )}
    </div>
  );
}
