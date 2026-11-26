'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

interface PinAccessModalProps {
  open: boolean;
  storeName?: string;
  error?: string;
  onSubmit: (pin: string) => void;
  onCancel?: () => void;
  eyebrow?: string;
  submitLabel?: string;
}

function cleanPin(value: string) {
  return value.replace(/\D/g, '').slice(0, 4);
}

export function PinAccessModal({ open, storeName, error, onSubmit, onCancel, eyebrow = 'Akses Store', submitLabel = 'Buka' }: PinAccessModalProps) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setPin('');
    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.click();
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [open, storeName]);

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pin.length !== 4) return;
    onSubmit(pin);
  }

  return (
    <div className="modal-backdrop pin-access-backdrop" role="dialog" aria-modal="true" aria-label="PIN Akses Store">
      <form className="modal-card pin-access-card" onSubmit={submit}>
        <div className="pin-access-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.2A1.8 1.8 0 0 1 20 11.8v8.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 20.2v-8.4A1.8 1.8 0 0 1 5.8 10H7Zm2 0h6V7a3 3 0 0 0-6 0v3Zm2 4v4h2v-4h-2Z" fill="currentColor" /></svg>
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{storeName || 'History Store'}</h2>
        <div className="field pin-access-field">
          <label>PIN AKSES 4 DIGIT</label>
          <input
            ref={inputRef}
            value={pin}
            onChange={(event) => setPin(cleanPin(event.target.value))}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={4}
            placeholder="••••"
            aria-label="PIN AKSES 4 DIGIT"
          />
        </div>
        {error ? <p className="notice pin-error">{error}</p> : null}
        <div className="actions pin-actions">
          <button className={`btn ${submitLabel.toLowerCase().includes('hapus') ? 'danger' : 'green'}`} type="submit" disabled={pin.length !== 4}>{submitLabel}</button>
          {onCancel ? <button className="btn secondary" type="button" onClick={onCancel}>Batal</button> : null}
        </div>
      </form>
    </div>
  );
}
