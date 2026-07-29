'use client';
import { useState, useRef } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  label?: string;
}

export function TagInput({
  value,
  onChange,
  maxTags = 30,
  label = 'Hashtags',
}: TagInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || value.includes(trimmed) || value.length >= maxTags) return;

    const formatted = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    onChange([...value, formatted]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        <span className="text-xs text-gray-500 ml-2">
          ({value.length}/{maxTags})
        </span>
      </label>

      <div className="flex flex-wrap gap-2 p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 bg-white dark:bg-gray-800">
        {value.map((tag) => (
          <div
            key={tag}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-full text-sm font-medium"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="hover:opacity-70 flex-shrink-0"
              aria-label={`Remover ${tag}`}
              type="button"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? '#trend #viral #reels' : ''}
          className="flex-1 min-w-24 outline-none dark:bg-gray-800 dark:text-white bg-white"
          disabled={value.length >= maxTags}
          aria-label="Adicionar hashtag"
        />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Digite uma hashtag e pressione Enter. Você pode adicionar até {maxTags} tags.
      </p>
    </div>
  );
}
