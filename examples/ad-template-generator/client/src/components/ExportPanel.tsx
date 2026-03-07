'use client';

import { useState } from 'react';
import type { Template } from '@/types/template';
import { exportStatic, exportVideo } from '@/lib/export';
import type { StaticFormat, VideoFormat } from '@/lib/export';

interface Props {
  template: Template;
  previewRef: React.RefObject<HTMLDivElement | null>;
}

type Format = StaticFormat | VideoFormat;

export function ExportPanel({ template, previewRef }: Props) {
  const [format, setFormat] = useState<Format>('png');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const staticFormats: StaticFormat[] = ['png', 'jpg', 'webp'];
  const videoFormats: VideoFormat[] = ['mp4', 'webm'];
  const isVideo = videoFormats.includes(format as VideoFormat);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setProgress(0);

    try {
      if (isVideo) {
        if (!template.animationConfig) {
          throw new Error('This template has no animation config. Export as image instead.');
        }
        await exportVideo(
          template.previewHtml,
          template.animationConfig.duration,
          30,
          format as VideoFormat,
          p => setProgress(Math.round(p)),
        );
      } else {
        // Get the iframe inside preview ref
        const iframe = previewRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
        const el = iframe?.contentDocument?.body ?? previewRef.current;
        if (!el) throw new Error('Preview element not found');
        await exportStatic(el as HTMLElement, format as StaticFormat, template.name.replace(/\s+/g, '-').toLowerCase());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
      setProgress(0);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">Export Format</p>

      <div className="space-y-2">
        <p className="text-xs text-gray-600">Image</p>
        <div className="flex gap-2">
          {staticFormats.map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1.5 rounded-lg text-sm uppercase font-mono transition-colors ${
                format === f ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {template.type === 'animation' && (
          <>
            <p className="text-xs text-gray-600 mt-2">Video</p>
            <div className="flex gap-2">
              {videoFormats.map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm uppercase font-mono transition-colors ${
                    format === f ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {isVideo && (
              <p className="text-xs text-amber-500 mt-1">
                Video export uses FFmpeg.wasm — may take 30–60s
              </p>
            )}
          </>
        )}
      </div>

      {exporting && isVideo && (
        <div className="space-y-1">
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-violet-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">{progress}%</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 rounded-lg p-2">{error}</p>
      )}

      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {exporting
          ? isVideo
            ? `Encoding... ${progress}%`
            : 'Exporting...'
          : `Export as ${format.toUpperCase()}`}
      </button>
    </div>
  );
}
