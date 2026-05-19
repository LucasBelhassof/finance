import { act, fireEvent, render, screen } from "@testing-library/react";
import { Pencil, Trash2 } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuItemIcon,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  TouchContextMenuTrigger,
} from "@/components/ui/context-menu";

function ContextMenuFixture({
  onEdit = vi.fn(),
  onDelete = vi.fn(),
  onTriggerContextMenu,
  onTriggerClick,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onTriggerContextMenu?: () => void;
  onTriggerClick?: () => void;
}) {
  return (
    <ContextMenu>
      <TouchContextMenuTrigger asChild>
        <button type="button" onContextMenu={onTriggerContextMenu} onClick={onTriggerClick}>
          Abrir menu
        </button>
      </TouchContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Ações</ContextMenuLabel>
        <ContextMenuItem onClick={onEdit}>
          <ContextMenuItemIcon>
            <Pencil size={16} />
          </ContextMenuItemIcon>
          Editar
          <ContextMenuShortcut>⌘E</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled>Desabilitado</ContextMenuItem>
        <ContextMenuRadioGroup value="compact">
          <ContextMenuRadioItem value="compact">Compacto</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <ContextMenuItemIcon className="text-destructive">
            <Trash2 size={16} />
          </ContextMenuItemIcon>
          Excluir
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

describe("context-menu", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders and opens from a desktop context menu interaction", () => {
    render(<ContextMenuFixture />);

    fireEvent.contextMenu(screen.getByRole("button", { name: "Abrir menu" }));

    expect(screen.getByText("Editar")).toBeInTheDocument();
    expect(screen.getByText("Compacto")).toBeInTheDocument();
    expect(screen.getByText("Excluir")).toBeInTheDocument();
  });

  it("keeps disabled items non-interactive and styles destructive items distinctly", () => {
    const onDelete = vi.fn();
    render(<ContextMenuFixture onDelete={onDelete} />);

    fireEvent.contextMenu(screen.getByRole("button", { name: "Abrir menu" }));

    const disabledItem = screen.getByText("Desabilitado");
    const destructiveItem = screen.getByText("Excluir");

    expect(disabledItem).toHaveAttribute("data-disabled");
    expect(destructiveItem).toHaveClass("text-destructive");

    fireEvent.click(disabledItem);
    fireEvent.click(destructiveItem);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("opens after a long press on touch devices", () => {
    const onTriggerContextMenu = vi.fn();
    render(<ContextMenuFixture onTriggerContextMenu={onTriggerContextMenu} />);

    const trigger = screen.getByRole("button", { name: "Abrir menu" });

    fireEvent.touchStart(trigger, {
      touches: [{ identifier: 1, clientX: 24, clientY: 32 }],
    });

    act(() => {
      vi.advanceTimersByTime(520);
    });

    expect(onTriggerContextMenu).toHaveBeenCalledTimes(1);
  });

  it("cancels the long press if the touch ends early", () => {
    const onTriggerContextMenu = vi.fn();
    render(<ContextMenuFixture onTriggerContextMenu={onTriggerContextMenu} />);

    const trigger = screen.getByRole("button", { name: "Abrir menu" });

    fireEvent.touchStart(trigger, {
      touches: [{ identifier: 1, clientX: 24, clientY: 32 }],
    });
    fireEvent.touchEnd(trigger, {
      changedTouches: [{ identifier: 1, clientX: 24, clientY: 32 }],
    });

    act(() => {
      vi.advanceTimersByTime(520);
    });

    expect(onTriggerContextMenu).not.toHaveBeenCalled();
    expect(screen.queryByText("Editar")).not.toBeInTheDocument();
  });
});
