import { useState } from 'react';
import { ImageType, IMAGE_TYPE_COLORS, IMAGE_TYPE_ICONS } from '../types';

interface QuestionImageProps {
  imageUrl: string;
  imageType?: ImageType;
  imageCaption?: string;
  compact?: boolean; // for question bank thumbnail mode
}

export default function QuestionImage({
  imageUrl,
  imageType = 'Other',
  imageCaption,
  compact = false,
}: QuestionImageProps) {
  const [zoomed, setZoomed] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);

  const colorClass = IMAGE_TYPE_COLORS[imageType] ?? IMAGE_TYPE_COLORS['Other'];
  const icon = IMAGE_TYPE_ICONS[imageType] ?? '🖼️';

  if (imgError) {
    return (
      <div className={`rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-400 ${compact ? 'h-24' : 'h-48'}`}>
        <span className="text-2xl mb-1">🖼️</span>
        <span className="text-xs">Image unavailable</span>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <div
          className="relative rounded-xl overflow-hidden border border-gray-200 cursor-zoom-in group"
          onClick={(e) => { e.stopPropagation(); setZoomed(true); }}
        >
          {/* Type badge */}
          <span className={`absolute top-2 left-2 z-10 text-xs font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
            {icon} {imageType}
          </span>
          <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/10 transition z-10 flex items-center justify-center`}>
            <span className="opacity-0 group-hover:opacity-100 transition bg-black/60 text-white text-xs px-2 py-1 rounded-lg">🔍 Zoom</span>
          </div>
          {!imgLoaded && (
            <div className="h-32 bg-gray-100 animate-pulse rounded-xl" />
          )}
          <img
            src={imageUrl}
            alt={imageCaption || imageType}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-32 object-cover transition-opacity ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>

        {/* Zoom Modal */}
        {zoomed && (
          <ImageModal
            imageUrl={imageUrl}
            imageType={imageType}
            imageCaption={imageCaption}
            colorClass={colorClass}
            icon={icon}
            brightness={brightness}
            contrast={contrast}
            invert={invert}
            onBrightnessChange={setBrightness}
            onContrastChange={setContrast}
            onInvertChange={setInvert}
            onClose={() => setZoomed(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-black">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${colorClass}`}>
              {icon} {imageType}
            </span>
            {imageCaption && (
              <span className="text-gray-300 text-xs truncate max-w-xs">{imageCaption}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Quick tools */}
            <button
              onClick={() => setInvert((p) => !p)}
              title="Invert colours (useful for X-rays)"
              className={`text-xs px-2 py-1 rounded-lg transition font-medium ${invert ? 'bg-yellow-400 text-gray-900' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              ◑ Invert
            </button>
            <button
              onClick={() => { setBrightness(100); setContrast(100); setInvert(false); }}
              title="Reset filters"
              className="text-xs px-2 py-1 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
            >
              ↺ Reset
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setZoomed(true); }}
              className="text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition"
            >
              🔍 Zoom
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="relative bg-black flex items-center justify-center min-h-[220px] max-h-[420px] overflow-hidden">
          {!imgLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400 text-xs">Loading {imageType}...</span>
            </div>
          )}
          <img
            src={imageUrl}
            alt={imageCaption || imageType}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            style={{
              filter: `brightness(${brightness}%) contrast(${contrast}%) invert(${invert ? 1 : 0})`,
              transition: 'filter 0.2s',
            }}
            className={`max-w-full max-h-[400px] object-contain cursor-zoom-in transition-opacity ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onClick={(e) => { e.stopPropagation(); setZoomed(true); }}
          />
        </div>

        {/* Controls bar */}
        {imgLoaded && (
          <div className="bg-gray-900 px-4 py-2 flex flex-wrap items-center gap-4 border-t border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>☀️ Brightness</span>
              <input
                type="range" min={20} max={200} value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-20 accent-blue-400"
              />
              <span className="w-8 text-gray-300">{brightness}%</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>◑ Contrast</span>
              <input
                type="range" min={20} max={200} value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-20 accent-blue-400"
              />
              <span className="w-8 text-gray-300">{contrast}%</span>
            </div>
            <span className="ml-auto text-gray-500 text-xs">Click image to zoom fullscreen</span>
          </div>
        )}
      </div>

      {/* Caption below image */}
      {imageCaption && imgLoaded && (
        <p className="text-center text-xs text-gray-500 italic mt-1">{imageCaption}</p>
      )}

      {/* Zoom Modal */}
      {zoomed && (
        <ImageModal
          imageUrl={imageUrl}
          imageType={imageType}
          imageCaption={imageCaption}
          colorClass={colorClass}
          icon={icon}
          brightness={brightness}
          contrast={contrast}
          invert={invert}
          onBrightnessChange={setBrightness}
          onContrastChange={setContrast}
          onInvertChange={setInvert}
          onClose={() => setZoomed(false)}
        />
      )}
    </>
  );
}

// ── Full-screen Zoom Modal ──────────────────────────────────────
interface ModalProps {
  imageUrl: string;
  imageType: ImageType;
  imageCaption?: string;
  colorClass: string;
  icon: string;
  brightness: number;
  contrast: number;
  invert: boolean;
  onBrightnessChange: (v: number) => void;
  onContrastChange: (v: number) => void;
  onInvertChange: (v: boolean) => void;
  onClose: () => void;
}

function ImageModal({
  imageUrl, imageType, imageCaption, colorClass, icon,
  brightness, contrast, invert,
  onBrightnessChange, onContrastChange, onInvertChange,
  onClose,
}: ModalProps) {
  const [scale, setScale] = useState(1);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Modal Header */}
      <div
        className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colorClass}`}>
            {icon} {imageType}
          </span>
          {imageCaption && (
            <span className="text-gray-300 text-sm">{imageCaption}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              className="text-white text-lg font-bold hover:text-blue-300 w-6 text-center"
            >−</button>
            <span className="text-gray-300 text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(5, s + 0.25))}
              className="text-white text-lg font-bold hover:text-blue-300 w-6 text-center"
            >+</button>
          </div>
          <button
            onClick={() => setScale(1)}
            className="text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
          >1:1</button>
          <button
            onClick={() => setScale(2)}
            className="text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
          >2×</button>
          <button
            onClick={onClose}
            className="ml-2 text-gray-300 hover:text-white bg-gray-700 hover:bg-red-600 rounded-lg px-3 py-1.5 text-sm font-bold transition"
          >✕ Close</button>
        </div>
      </div>

      {/* Image Area */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={imageCaption || imageType}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            filter: `brightness(${brightness}%) contrast(${contrast}%) invert(${invert ? 1 : 0})`,
            transition: 'transform 0.2s, filter 0.2s',
            maxWidth: '90vw',
            maxHeight: '70vh',
            objectFit: 'contain',
            cursor: scale > 1 ? 'move' : 'zoom-in',
          }}
          onClick={(e) => { e.stopPropagation(); setScale((s) => (s >= 3 ? 1 : s + 0.5)); }}
        />
      </div>

      {/* Bottom Controls */}
      <div
        className="bg-gray-900 border-t border-gray-700 px-6 py-3 flex flex-wrap items-center gap-6 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>☀️ Brightness</span>
          <input type="range" min={20} max={200} value={brightness}
            onChange={(e) => onBrightnessChange(Number(e.target.value))}
            className="w-28 accent-blue-400" />
          <span className="text-gray-300 w-8">{brightness}%</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>◑ Contrast</span>
          <input type="range" min={20} max={200} value={contrast}
            onChange={(e) => onContrastChange(Number(e.target.value))}
            className="w-28 accent-blue-400" />
          <span className="text-gray-300 w-8">{contrast}%</span>
        </div>
        <button
          onClick={() => onInvertChange(!invert)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${invert ? 'bg-yellow-400 text-gray-900' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          ◑ Invert {invert ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => { onBrightnessChange(100); onContrastChange(100); onInvertChange(false); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
        >
          ↺ Reset All
        </button>
        <span className="ml-auto text-gray-500 text-xs hidden sm:block">
          Click image to zoom · Use +/− to scale · Click outside to close
        </span>
      </div>
    </div>
  );
}
