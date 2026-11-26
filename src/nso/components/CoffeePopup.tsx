import React from 'react';

export function CoffeePopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop no-print coffee-popup-backdrop">
      <style>{`.coffee-popup-backdrop { z-index: 99999 !important; }`}</style>
      <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center', padding: '24px' }}>
        <h2 style={{ marginBottom: '12px', fontSize: '22px' }}>Traktir Segelas Kopi! ☕</h2>
        <p style={{ marginBottom: '20px', color: '#475569', fontSize: '15px', lineHeight: '1.5' }}>
          Terima kasih orang-orang baik.<br/>Dukungan kalian sangat berarti untuk terus mengembangkan sistem ini.
        </p>
        <a 
          href="https://trakteer.id/HEHBESTIE/tip?quantity=1" 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn green"
          style={{ display: 'inline-flex', marginBottom: '16px', width: '100%', justifyContent: 'center' }}
        >
          Traktir Kopi Sekarang
        </a>
        <button className="btn secondary" onClick={onClose} style={{ width: '100%' }}>
          Nanti Saja
        </button>
      </div>
    </div>
  );
}
