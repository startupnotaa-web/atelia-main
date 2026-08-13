'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';

export default function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-label="Mais informações"
        className="text-slate-400 hover:text-primary transition-colors"
      >
        <Info size={15} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-xl bg-secondary text-white text-xs font-medium px-3 py-2 shadow-lg leading-snug"
        >
          {text}
        </span>
      )}
    </span>
  );
}
