import { useLocale } from "../i18n/react";
import { localize, t } from "../i18n/core";
import { Chevron } from "./Chevron";
/* Select-only combobox: focus remains on the trigger; options use aria-activedescendant. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

type Entry = { value: string; label: string; disabled: boolean; group?: string };
type OptionProps = {
  children?: ReactNode;
  value?: string | number;
  disabled?: boolean;
  label?: string;
};
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange" | "children"> & {
  value: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
  displayValue?: ReactNode;
  renderOption?: (option: Readonly<Entry>) => ReactNode;
  menuClassName?: string;
  menuAlign?: "start" | "end";
};

function text(children: ReactNode): string {
  return Children.toArray(children)
    .map((child): string => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      return isValidElement<OptionProps>(child) ? text(child.props.children) : "";
    })
    .join("");
}
function entries(children: ReactNode, group?: string, disabled = false): Entry[] {
  return Children.toArray(children).flatMap((child): Entry[] => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type === "optgroup")
      return entries(child.props.children, child.props.label, disabled || !!child.props.disabled);
    if (child.type === Fragment) return entries(child.props.children, group, disabled);
    if (child.type !== "option") return [];
    const label = child.props.label ?? text(child.props.children);
    return [
      {
        value: String(child.props.value ?? label),
        label,
        disabled: disabled || !!child.props.disabled,
        group,
      },
    ];
  });
}

/** Shared, keyboard-operable game menu. Popovers stay above native modal dialogs. */
export function GameSelect({
  value,
  onValueChange,
  children,
  displayValue,
  renderOption,
  menuClassName = "",
  menuAlign = "start",
  className = "",
  disabled,
  id,
  onKeyDown,
  onBlur,
  ...props
}: Props) {
  useLocale();

  const uid = useId();
  const triggerId = id || `${uid}-trigger`;
  const menuId = `${uid}-menu`;
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(-1);
  const options = entries(children);
  const chosen = options.findIndex((entry) => entry.value === String(value));
  const available = options
    .map((entry, index) => (entry.disabled ? -1 : index))
    .filter((index) => index >= 0);

  function show(index = chosen) {
    if (disabled || !available.length) return;
    setPortalHost(trigger.current?.closest("dialog") || document.body);
    setActive(available.includes(index) ? index : available[0]);
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    setOpen(false);
    onValueChange(option.value);
    trigger.current?.focus({ preventScroll: true });
  }
  function keydown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    // Keep map editor shortcuts away from dropdown navigation and typeahead.
    event.stopPropagation();
    const current = open ? active : chosen;
    const next = available.indexOf(current);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const index = available[(next + direction + available.length) % available.length];
      if (open) setActive(index ?? -1);
      else show(chosen >= 0 ? chosen : index);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const index = event.key === "Home" ? available[0] : available.at(-1);
      if (open) setActive(index ?? -1);
      else show(index);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else show();
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") setOpen(false);
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const query = now - search.current.time > 700 ? event.key : search.current.text + event.key;
      search.current = { text: query, time: now };
      const repeated = [...query].every((char) => char === query[0]);
      const needle = (repeated ? query[0] : query).toLocaleLowerCase();
      const start = repeated ? current + 1 : current;
      const index = options
        .map((_, offset) => (Math.max(0, start) + offset) % options.length)
        .find(
          (i) => !options[i].disabled && options[i].label.toLocaleLowerCase().startsWith(needle),
        );
      if (index !== undefined) {
        event.preventDefault();
        if (open) setActive(index);
        else show(index);
      }
    }
  }

  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const popup = menu.current;
    const anchor = trigger.current;
    let naturalWidth = 196;
    function place() {
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? document.documentElement.clientWidth;
      const height = viewport?.height ?? window.innerHeight;
      const below = top + height - rect.bottom - 12;
      const above = rect.top - top - 12;
      const up = below < Math.min(popup.scrollHeight, 240) && above > below;
      const popupWidth = Math.min(Math.max(rect.width, naturalWidth), width - 16);
      const maxHeight = Math.max(40, Math.min(344, up ? above : below));
      popup.style.width = `${popupWidth}px`;
      popup.style.maxHeight = `${maxHeight}px`;
      popup.style.left = `${Math.max(left + 8, Math.min(menuAlign === "end" ? rect.right - popupWidth : rect.left, left + width - popupWidth - 8))}px`;
      popup.style.top = `${up ? Math.max(top + 8, rect.top - Math.min(popup.scrollHeight, maxHeight) - 4) : rect.bottom + 4}px`;
    }
    const toggled = (event: ToggleEvent) => {
      if (event.newState === "closed") setOpen(false);
    };
    popup.addEventListener("toggle", toggled);
    popup.showPopover();
    naturalWidth = Math.max(196, popup.getBoundingClientRect().width);
    place();
    const reposition = (event: Event) => {
      if (event.target !== popup) place();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      popup.removeEventListener("toggle", toggled);
      popup.hidePopover();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open, menuAlign]);
  useEffect(() => {
    if (open) document.getElementById(`${menuId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, menuId]);

  return (
    <>
      <button
        {...props}
        id={triggerId}
        ref={trigger}
        type="button"
        className={`wt-select ${className}`}
        role="combobox"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open && active >= 0 ? `${menuId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={keydown}
        onBlur={(event) => {
          onBlur?.(event);
          setOpen(false);
        }}
      >
        <span className="wt-select-label">
          {displayValue ?? options[chosen]?.label ?? t("请选择")}
        </span>
        <Chevron className="wt-select-chevron" />
      </button>
      {localize(
        open &&
          portalHost &&
          createPortal(
            <div
              id={menuId}
              ref={menu}
              className={`wt-select-menu ${menuClassName}`}
              popover="auto"
              role="listbox"
              tabIndex={-1}
              aria-labelledby={triggerId}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {localize(
                options.map((option, index) => (
                  <Fragment key={`${option.value}-${index}`}>
                    {localize(
                      option.group && option.group !== options[index - 1]?.group && (
                        <div className="wt-select-group" role="presentation">
                          {option.group}
                        </div>
                      ),
                    )}
                    <div
                      id={`${menuId}-${index}`}
                      className="wt-select-option"
                      role="option"
                      tabIndex={-1}
                      aria-selected={index === chosen}
                      aria-disabled={option.disabled || undefined}
                      data-active={index === active || undefined}
                      title={option.label}
                      onPointerDown={(event) => event.preventDefault()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          choose(index);
                        }
                      }}
                      onPointerMove={(event) => {
                        if (event.pointerType === "mouse" && !option.disabled) setActive(index);
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        choose(index);
                      }}
                    >
                      <span className="wt-select-check" aria-hidden="true">
                        {localize(index === chosen ? "✓" : "")}
                      </span>
                      <span>{renderOption ? renderOption(option) : option.label}</span>
                    </div>
                  </Fragment>
                )),
              )}
            </div>,
            portalHost,
          ),
      )}
    </>
  );
}
