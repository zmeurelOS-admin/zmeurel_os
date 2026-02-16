'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'white',
          color: '#312E3F',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
        },
        className: 'sonner-toast',
        descriptionClassName: 'sonner-toast-description',
        actionButtonStyle: {
          background: '#F16B6B',
          color: 'white',
        },
        cancelButtonStyle: {
          background: '#f3f4f6',
          color: '#312E3F',
        },
      }}
    />
  );
}