'use client';

import { useState, useCallback, useRef } from 'react';

// Non-blocking replacement for alert(). Usage:
//   const { toast, ToastHost } = useToast();
//   toast('Saved', 'success');   // 'success' | 'error' | 'info'
//   ...render <ToastHost /> once in the page
export function useToast() {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'info', ms = 4500) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), ms);
  }, []);

  const ToastHost = useCallback(
    () => (
      <div className="toast-host" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    ),
    [items]
  );

  return { toast, ToastHost };
}
