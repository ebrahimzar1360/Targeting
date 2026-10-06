import { Dialog as D, AlertDialog as AD } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button, cx } from "./primitives";

/** Side panel for editing one item; becomes a full-height sheet on phones. */
export function Sheet({ open, onOpenChange, title, description, children, footer, wide }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode;
  children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="anim-fade fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" />
        <D.Content
          className={cx(
            "anim-sheet fixed inset-y-0 end-0 z-50 flex w-full flex-col bg-surface shadow-pop outline-none sm:border-s sm:border-line",
            wide ? "sm:max-w-2xl" : "sm:max-w-xl",
          )}
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <D.Title className="text-base font-semibold leading-7">{title}</D.Title>
              {description && <D.Description className="mt-0.5 text-[13px] leading-5 text-ink-3">{description}</D.Description>}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="بستن"><X className="size-4" /></Button>
            </D.Close>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="safe-bottom flex items-center gap-2 border-t border-line bg-surface px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Modal({ open, onOpenChange, title, description, children, footer, size = "md" }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode;
  children: ReactNode; footer?: ReactNode; size?: "md" | "lg";
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="anim-fade fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" />
        <D.Content
          aria-describedby={undefined}
          className={cx(
            "anim-rise fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-surface shadow-pop outline-none",
            "sm:inset-auto sm:start-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:translate-x-1/2 sm:rounded-2xl sm:border sm:border-line",
            size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
          )}
        >
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
            <div>
              <D.Title className="text-base font-semibold leading-7">{title}</D.Title>
              {description && <D.Description className="mt-0.5 text-[13px] leading-6 text-ink-3">{description}</D.Description>}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="بستن"><X className="size-4" /></Button>
            </D.Close>
          </div>
          <div className="scrollbar-thin overflow-y-auto px-5 py-3">{children}</div>
          {footer && <div className="safe-bottom flex flex-wrap items-center justify-end gap-2 px-5 pb-5 pt-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Confirm({ open, onOpenChange, title, description, confirmLabel = "تأیید", danger, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode;
  confirmLabel?: string; danger?: boolean; onConfirm: () => void;
}) {
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal>
        <AD.Overlay className="anim-fade fixed inset-0 z-40 bg-black/30" />
        <AD.Content className="anim-rise fixed start-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-y-1/2 translate-x-1/2 rounded-2xl border border-line bg-surface p-5 shadow-pop">
          <AD.Title className="text-base font-semibold">{title}</AD.Title>
          {description && <AD.Description className="mt-2 text-sm leading-6 text-ink-2">{description}</AD.Description>}
          <div className="mt-5 flex justify-end gap-2">
            <AD.Cancel asChild><Button>انصراف</Button></AD.Cancel>
            <AD.Action asChild><Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button></AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
