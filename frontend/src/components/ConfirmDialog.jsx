import { useState } from 'react';

export default function ConfirmDialog({
  message,
  onConfirm,
  triggerLabel,
  triggerClassName = 'btn-danger',
  confirmLabel = 'Yes, delete',
  cancelLabel = 'Cancel',
}) {
  const [pending, setPending] = useState(false);

  function handleTriggerClick() {
    setPending(true);
  }

  async function handleConfirm() {
    await onConfirm();
    setPending(false);
  }

  function handleCancel() {
    setPending(false);
  }

  if (!pending) {
    return (
      <button type="button" className={triggerClassName} onClick={handleTriggerClick}>
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm text-sage-700">{message}</span>
      <button type="button" className="btn-danger" onClick={handleConfirm}>
        {confirmLabel}
      </button>
      <button type="button" className="btn-ghost" onClick={handleCancel}>
        {cancelLabel}
      </button>
    </div>
  );
}
