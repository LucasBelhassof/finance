import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuPortal = ContextMenuPrimitive.Portal;
const ContextMenuSub = ContextMenuPrimitive.Sub;
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const menuContentClassName = cn(
  "z-50 min-w-[15rem] overflow-hidden rounded-2xl border border-border/60 bg-card/85 p-2 text-popover-foreground shadow-[0_24px_60px_rgba(2,6,23,0.48),0_10px_30px_rgba(15,23,42,0.22),var(--shadow-glow)] backdrop-blur-xl",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  "motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none",
);

const menuItemClassName = cn(
  "relative flex min-h-10 cursor-default select-none items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium text-popover-foreground outline-none transition-colors duration-150",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  "data-[highlighted]:bg-primary/10 data-[highlighted]:text-foreground data-[highlighted]:shadow-[inset_0_0_0_1px_rgba(34,197,94,0.08)]",
  "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0",
);

type MenuItemVariant = "default" | "destructive";

function resolveMenuItemVariantClassName(variant: MenuItemVariant) {
  if (variant === "destructive") {
    return "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive";
  }

  return "";
}

function setRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

function composeEventHandlers<EventType extends { defaultPrevented: boolean }>(
  theirHandler: ((event: EventType) => void) | undefined,
  ourHandler: (event: EventType) => void,
) {
  return (event: EventType) => {
    theirHandler?.(event);

    if (!event.defaultPrevented) {
      ourHandler(event);
    }
  };
}

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

type TouchContextMenuTriggerProps = React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Trigger> & {
  longPressDelay?: number;
  longPressMovementThreshold?: number;
};

const TouchContextMenuTrigger = React.forwardRef<HTMLElement, TouchContextMenuTriggerProps>(
  (
    {
      longPressDelay = 500,
      longPressMovementThreshold = 12,
      disabled,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
      ...props
    },
    forwardedRef,
  ) => {
    const localRef = React.useRef<HTMLElement | null>(null);
    const timeoutRef = React.useRef<number | null>(null);
    const pointerIdRef = React.useRef<number | null>(null);
    const touchIdentifierRef = React.useRef<number | null>(null);
    const startPositionRef = React.useRef<{ x: number; y: number } | null>(null);
    const removeScrollListenerRef = React.useRef<(() => void) | null>(null);
    const suppressClickRef = React.useRef(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

    const clearLongPress = React.useCallback(() => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      removeScrollListenerRef.current?.();
      removeScrollListenerRef.current = null;
      pointerIdRef.current = null;
      touchIdentifierRef.current = null;
      startPositionRef.current = null;
    }, []);

    React.useEffect(() => {
      if (typeof window === "undefined") {
        return undefined;
      }

      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

      syncPreference();
      mediaQuery.addEventListener("change", syncPreference);

      return () => {
        mediaQuery.removeEventListener("change", syncPreference);
      };
    }, []);

    React.useEffect(() => clearLongPress, [clearLongPress]);

    const openContextMenuAtPoint = React.useCallback(
      (x: number, y: number) => {
        if (!localRef.current || disabled) {
          return;
        }

        suppressClickRef.current = true;
        clearLongPress();

        localRef.current.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            button: 2,
            buttons: 2,
          }),
        );
      },
      [clearLongPress, disabled],
    );

    const scheduleLongPress = React.useCallback(
      (x: number, y: number) => {
        startPositionRef.current = { x, y };

        const handleScrollCancel = () => clearLongPress();
        window.addEventListener("scroll", handleScrollCancel, true);
        removeScrollListenerRef.current = () => {
          window.removeEventListener("scroll", handleScrollCancel, true);
        };

        timeoutRef.current = window.setTimeout(
          () => {
            openContextMenuAtPoint(x, y);
          },
          prefersReducedMotion ? Math.min(longPressDelay, 450) : longPressDelay,
        );
      },
      [clearLongPress, longPressDelay, openContextMenuAtPoint, prefersReducedMotion],
    );

    const cancelLongPressOnMove = React.useCallback(
      (x: number, y: number) => {
        if (!startPositionRef.current || timeoutRef.current === null) {
          return;
        }

        const distanceX = Math.abs(x - startPositionRef.current.x);
        const distanceY = Math.abs(y - startPositionRef.current.y);

        if (distanceX > longPressMovementThreshold || distanceY > longPressMovementThreshold) {
          clearLongPress();
        }
      },
      [clearLongPress, longPressMovementThreshold],
    );

    return (
      <ContextMenuPrimitive.Trigger
        ref={(node) => {
          localRef.current = node as HTMLElement | null;
          setRef(forwardedRef, node as HTMLElement);
        }}
        disabled={disabled}
        onClickCapture={composeEventHandlers(onClickCapture, (event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = false;
          }
        })}
        onPointerDown={composeEventHandlers(onPointerDown, (event) => {
          if (disabled || event.pointerType === "mouse" || event.button !== 0) {
            return;
          }

          pointerIdRef.current = event.pointerId;

          if ("setPointerCapture" in event.currentTarget) {
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // noop
            }
          }
          scheduleLongPress(event.clientX, event.clientY);
        })}
        onPointerMove={composeEventHandlers(onPointerMove, (event) => {
          if (pointerIdRef.current !== event.pointerId) {
            return;
          }

          cancelLongPressOnMove(event.clientX, event.clientY);
        })}
        onPointerUp={composeEventHandlers(onPointerUp, (event) => {
          if (pointerIdRef.current === event.pointerId) {
            clearLongPress();
          }

          if ("releasePointerCapture" in event.currentTarget) {
            try {
              event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
              // noop
            }
          }
        })}
        onPointerCancel={composeEventHandlers(onPointerCancel, (event) => {
          if (pointerIdRef.current === event.pointerId) {
            clearLongPress();
          }
        })}
        onTouchStart={composeEventHandlers(onTouchStart, (event) => {
          if (disabled || event.touches.length === 0 || pointerIdRef.current !== null) {
            return;
          }

          const touch = event.touches[0];
          touchIdentifierRef.current = touch.identifier;
          scheduleLongPress(touch.clientX, touch.clientY);
        })}
        onTouchMove={composeEventHandlers(onTouchMove, (event) => {
          if (touchIdentifierRef.current === null) {
            return;
          }

          const touch = Array.from(event.touches).find((item) => item.identifier === touchIdentifierRef.current);

          if (!touch) {
            clearLongPress();
            return;
          }

          cancelLongPressOnMove(touch.clientX, touch.clientY);
        })}
        onTouchEnd={composeEventHandlers(onTouchEnd, () => {
          if (touchIdentifierRef.current !== null) {
            clearLongPress();
          }
        })}
        onTouchCancel={composeEventHandlers(onTouchCancel, () => {
          if (touchIdentifierRef.current !== null) {
            clearLongPress();
          }
        })}
        {...props}
      />
    );
  },
);
TouchContextMenuTrigger.displayName = "TouchContextMenuTrigger";

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      menuItemClassName,
      "data-[state=open]:bg-primary/12 data-[state=open]:text-foreground",
      inset && "pl-9",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform data-[state=open]:translate-x-0.5" />
  </ContextMenuPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, sideOffset = 10, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    sideOffset={sideOffset}
    className={cn(menuContentClassName, className)}
    {...props}
  />
));
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, sideOffset = 10, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(menuContentClassName, className)}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean;
    variant?: MenuItemVariant;
  }
>(({ className, inset, variant = "default", ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(menuItemClassName, inset && "pl-9", resolveMenuItemVariantClassName(variant), className)}
    {...props}
  />
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(menuItemClassName, "pl-10", className)}
    checked={checked}
    {...props}
  >
    <span className="absolute left-3 flex h-4 w-4 items-center justify-center rounded-full bg-primary/8 text-primary">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName;

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem ref={ref} className={cn(menuItemClassName, "pl-10", className)} {...props}>
    <span className="absolute left-3 flex h-4 w-4 items-center justify-center rounded-full bg-primary/8 text-primary">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-2.5 w-2.5 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName;

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground",
      inset && "pl-10",
      className,
    )}
    {...props}
  />
));
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1.5 h-px bg-border/60", className)} {...props} />
));
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      "ml-auto pl-6 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80",
      className,
    )}
    {...props}
  />
);
ContextMenuShortcut.displayName = "ContextMenuShortcut";

const ContextMenuItemIcon = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground", className)}
    {...props}
  />
);
ContextMenuItemIcon.displayName = "ContextMenuItemIcon";

export {
  ContextMenu,
  ContextMenuTrigger,
  TouchContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuItemIcon,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
