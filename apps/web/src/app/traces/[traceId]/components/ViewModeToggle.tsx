'use client';

export type ViewMode = 'formatted' | 'json';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex bg-gray-100 p-1 rounded-md">
      <button
        onClick={() => onChange('formatted')}
        className={`px-3 py-1 rounded-sm text-sm font-medium transition-colors ${
          value === 'formatted'
            ? 'bg-white shadow-sm text-gray-900'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Formatter
      </button>
      <button
        onClick={() => onChange('json')}
        className={`px-3 py-1 rounded-sm text-sm font-medium transition-colors ${
          value === 'json'
            ? 'bg-white shadow-sm text-gray-900'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        JSON
      </button>
    </div>
  );
}