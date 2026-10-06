import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './controls';
import { IconClose } from './icons';
import { useMotionScale } from '../motion/useMotion';
import { useT } from '../i18n';

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

function useDialogBehaviour(open: boolean, onClose: () => void, ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) return;
        const a = items[0]!;
        const z = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [open]);
}

interface PanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ open, title, onClose, children, footer, wide }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { d } = useMotionScale();
  const t = useT();
  useDialogBehaviour(open, onClose, ref);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="p-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: d(0.16) }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`p-modal${wide ? ' wide' : ''}`}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34, duration: d(0.24) }}
          >
            <div className="p-modal-h">
              <h2>{title}</h2>
              <Button variant="ghost" size="icon" aria-label={t('act.close')} onClick={onClose}><IconClose /></Button>
            </div>
            <div className="p-modal-b">{children}</div>
            {footer && <div className="p-modal-f">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Drawer({ open, title, onClose, children, footer }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { d } = useMotionScale();
  const t = useT();
  useDialogBehaviour(open, onClose, ref);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="p-scrim right" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: d(0.16) }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.aside
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="p-drawer"
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ duration: d(0.24), ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="p-modal-h">
              <h2>{title}</h2>
              <Button variant="ghost" size="icon" aria-label={t('act.close')} onClick={onClose}><IconClose /></Button>
            </div>
            <div className="p-modal-b">{children}</div>
            {footer && <div className="p-modal-f">{footer}</div>}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({ open, title, body, confirmLabel, danger, onConfirm, onCancel }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const t = useT();
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('act.cancel')}</Button>
          <Button variant={danger ? 'danger' : 'primary'} data-autofocus onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}
