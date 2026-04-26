import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AiChat from "@/components/AiChat";

const mockUseChatConversationMessages = vi.fn();
const mockUseSendChatConversationMessages = vi.fn();

vi.mock("@/hooks/use-chat", () => ({
  DEFAULT_CHAT_LIMIT: 20,
  useChatConversationMessages: (...args: unknown[]) => mockUseChatConversationMessages(...args),
  useSendChatConversationMessages: (...args: unknown[]) => mockUseSendChatConversationMessages(...args),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

function arrangeChat({ isPending = false } = {}) {
  mockUseChatConversationMessages.mockReturnValue({
    data: [
      {
        id: 1,
        role: "assistant",
        content: "Ola",
        createdAt: "2026-04-06T10:00:00.000Z",
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  });
  mockUseSendChatConversationMessages.mockReturnValue({
    isPending,
    mutateAsync: vi.fn().mockResolvedValue({}),
  });
}

describe("AiChat", () => {
  it("keeps the send icon while a normal response is pending", () => {
    arrangeChat({ isPending: true });

    render(<AiChat chatId="chat-1" />);

    expect(screen.getByPlaceholderText("Pergunte sobre suas financas...")).not.toBeDisabled();
    expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("blocks the main input during planning draft generation", () => {
    arrangeChat();

    render(<AiChat chatId="chat-1" planningInProgress />);

    const input = screen.getByPlaceholderText("Gerando rascunho de planejamento...");
    expect(input).toBeDisabled();

    fireEvent.change(input, { target: { value: "mais uma mensagem" } });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("starts a new conversation from the first message when no chat exists", async () => {
    arrangeChat();
    const onStartConversation = vi.fn().mockResolvedValue(true);

    render(<AiChat onStartConversation={onStartConversation} />);

    const input = screen.getByPlaceholderText("Pergunte sobre suas financas...");
    fireEvent.change(input, { target: { value: "Quero organizar minhas contas" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(onStartConversation).toHaveBeenCalledWith("Quero organizar minhas contas");
    });
  });
});
