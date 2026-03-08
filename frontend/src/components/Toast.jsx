import { useEffect } from 'react';

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (toast.duration === 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const colorClasses =
    toast.variant === 'success' ? 'bg-sage-600 text-white' : 'bg-terracotta-500 text-white';

  const icon = toast.variant === 'success' ? '✓' : '✕';

  return (
    <div
      role="alert"
      className={`min-w-64 max-w-xs flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${colorClasses}`}
    >
      <span aria-hidden="true" className="text-base font-bold">
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="ml-auto text-white/70 hover:text-white transition-colors cursor-pointer bg-transparent border-0 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

export default Toast;
