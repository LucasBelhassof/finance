import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardChatCard from "@/components/DashboardChatCard";
import { appRoutes } from "@/lib/routes";

const mockUseChatConversations = vi.fn();
const mockUseCreateChatConversation = vi.fn();
const mockNavigate = vi.fn();
const mockCreateChatMutateAsync = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/use-chat", () => ({
  useChatConversations: (...args: unknown[]) => mockUseChatConversations(...args),
  useCreateChatConversation: (...args: unknown[]) => mockUseCreateChatConversation(...args),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <select aria-label="Escolher conversa do chat financeiro" value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>,
}));

vi.mock("@/components/AiChat", () => ({
  default: ({
    onStartConversation,
    creatingConversation,
  }: {
    onStartConversation?: (message: string) => Promise<boolean>;
    creatingConversation?: boolean;
  }) => (
    <div>
      <span>{creatingConversation ? "criando chat" : "chat pronto"}</span>
      <button type="button" onClick={() => void onStartConversation?.("Quero organizar minhas contas")}>
        enviar mensagem inicial
      </button>
    </div>
  ),
}));

describe("DashboardChatCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatConversations.mockReturnValue({
      data: [
        {
          id: "chat-1",
          title: "Planejamento mensal",
        },
      ],
    });
    mockUseCreateChatConversation.mockReturnValue({
      isPending: false,
      mutateAsync: mockCreateChatMutateAsync.mockResolvedValue({ id: "chat-2" }),
    });
  });

  it("creates a new chat from the dashboard first message and navigates to it", async () => {
    render(<DashboardChatCard />);

    fireEvent.click(screen.getByRole("button", { name: /enviar mensagem inicial/i }));

    await waitFor(() => {
      expect(mockCreateChatMutateAsync).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith(`${appRoutes.chat}/chat-2`, {
      state: { initialMessage: "Quero organizar minhas contas" },
    });
  });

  it("opens an existing chat route with the typed first message when one is selected", async () => {
    render(<DashboardChatCard />);

    fireEvent.change(screen.getByLabelText("Escolher conversa do chat financeiro"), {
      target: { value: "chat-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar mensagem inicial/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`${appRoutes.chat}/chat-1`, {
        state: { initialMessage: "Quero organizar minhas contas" },
      });
    });
  });
});
