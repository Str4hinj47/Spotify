import React, { useEffect, useId, useRef, useState } from "react";
import { Ellipsis, Music2, X } from "lucide-react";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-colors disabled:opacity-40 disabled:pointer-events-none select-none";

export const buttonStyles = {
  primary: `${BUTTON_BASE} bg-accent text-accent-ink hover:brightness-110 h-10 px-5 text-[15px]`,
  secondary: `${BUTTON_BASE} bg-surface2 text-ink hover:bg-line h-10 px-4 text-[15px]`,
  ghost: `${BUTTON_BASE} text-ink2 hover:text-ink hover:bg-surface2 h-10 px-3 text-[15px] font-medium`,
};

export function Button({ variant = "secondary", className = "", children, ...props }) {
  return (
    <button type="button" className={`${buttonStyles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// Icon-only control. `label` is required: it becomes the accessible name.
export function IconButton({ label, icon: Icon, size = 20, className = "", active = false, shortcut, iconProps = {}, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-keyshortcuts={shortcut}
      aria-pressed={props["aria-pressed"]}
      className={`inline-flex items-center justify-center rounded-full h-10 w-10 md:h-9 md:w-9 shrink-0 transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        active ? "text-accent" : "text-ink2 hover:text-ink"
      } hover:bg-surface2 ${className}`}
      {...props}
    >
      <Icon size={size} strokeWidth={2} aria-hidden="true" {...iconProps} />
    </button>
  );
}

export function Cover({ src, alt = "", className = "", iconSize = 24 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-surface2 to-line text-ink2 ${className}`} aria-hidden="true">
        <Music2 size={iconSize} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover bg-surface2 ${className}`}
    />
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6 max-w-md mx-auto">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-surface2 flex items-center justify-center text-ink2 mb-1">
          <Icon size={26} aria-hidden="true" />
        </div>
      )}
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {children && <p className="text-ink2 text-[15px] leading-relaxed">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Modal dialog: Escape closes, focus moves inside and returns to the trigger on close.
export function Dialog({ open, onClose, title, children, size = "md" }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // read through a ref so re-renders don't re-focus the dialog
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    const first = panelRef.current?.querySelector("input, button, iframe, [tabindex]");
    first?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && previous.focus) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  const width = { md: "max-w-md", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${width} max-h-[92dvh] overflow-y-auto scroll-thin bg-surface border border-line rounded-t-[20px] sm:rounded-card shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
          <h2 id={titleId} className="text-lg font-bold tracking-tight truncate">
            {title}
          </h2>
          <IconButton label="Close" icon={X} onClick={onClose} />
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

// Popover menu. Items: {id, label, icon, onSelect, danger, disabled} or {id, label, icon, submenu: [...]}
// or {separator: true}. Submenus expand in place (used for "Add to playlist").
export function MoreMenu({ items, label = "More actions", className = "", size = 20, align = "right" }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn) => {
    setOpen(false);
    setExpanded(null);
    fn && fn();
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <IconButton
        label={label}
        icon={Ellipsis}
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setExpanded(null);
        }}
      />
      {open && (
        <div
          role="menu"
          className={`absolute z-40 mt-1 top-full ${align === "right" ? "right-0" : "left-0"} w-60 max-h-[60vh] overflow-y-auto scroll-thin bg-surface2 border border-line rounded-2xl shadow-2xl p-1.5`}
        >
          {items.map((item, i) => {
            if (item.separator) return <div key={`sep-${i}`} role="separator" className="my-1.5 h-px bg-line" />;
            const Icon = item.icon;
            if (item.submenu) {
              const isOpen = expanded === item.id;
              return (
                <div key={item.id}>
                  <button
                    role="menuitem"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-ink hover:bg-line"
                  >
                    {Icon && <Icon size={18} aria-hidden="true" className="text-ink2" />}
                    <span className="flex-1 text-left">{item.label}</span>
                    <span aria-hidden="true" className="text-ink2">{isOpen ? "▾" : "▸"}</span>
                  </button>
                  {isOpen && (
                    <div className="ml-3 pl-3 border-l border-line">
                      {item.submenu.length === 0 && (
                        <p className="px-3 py-2 text-sm text-ink2">{item.emptyLabel || "Nothing here yet"}</p>
                      )}
                      {item.submenu.map((sub) => (
                        <button
                          key={sub.id}
                          role="menuitem"
                          onClick={() => run(sub.onSelect)}
                          className="w-full text-left px-3 py-2 rounded-xl text-[15px] text-ink hover:bg-line truncate"
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={item.id}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => run(item.onSelect)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] hover:bg-line disabled:opacity-40 disabled:pointer-events-none ${
                  item.danger ? "text-danger" : "text-ink"
                }`}
              >
                {Icon && <Icon size={18} aria-hidden="true" className={item.danger ? "" : "text-ink2"} />}
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SectionHeader({ title, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <h1 className="text-3xl md:text-[34px] font-bold tracking-tight leading-tight">{title}</h1>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
