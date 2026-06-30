"use client";

import { ReactNode } from "react";

interface StickyActionButtonProps {
  onClick: () => void;
  children: ReactNode;
}

export function StickyActionButton({ onClick, children }: StickyActionButtonProps) {
  return (
    <div className="lg:hidden fixed bottom-20 left-0 right-0 px-4 z-40">
      <button
        onClick={onClick}
        className="w-full h-12 bg-[var(--indicator-shop)] text-white rounded-2xl shadow-lg font-bold text-base active:scale-95 transition-transform"
      >
        {children}
      </button>
    </div>
  );
}
