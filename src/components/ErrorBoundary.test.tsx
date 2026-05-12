import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "@/components/ErrorBoundary";

function ThrowingComponent() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  const reloadMock = vi.fn();
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    reloadMock.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadMock,
      },
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it("renders a fallback UI when a descendant crashes", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /algo deu errado/i })).toBeInTheDocument();
    expect(screen.getByText(/ocorreu um erro inesperado na interface/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ir para dashboard/i })).toHaveAttribute("href", "/");
  });

  it("allows reloading the page from the fallback", async () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /recarregar página/i }));

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
