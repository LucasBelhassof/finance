import { Loader2, MessageSquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AiChat from "@/components/AiChat";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useChatConversations, useCreateChatConversation } from "@/hooks/use-chat";
import { appRoutes } from "@/lib/routes";

const NEW_CHAT_VALUE = "__new__";
const INLINE_SELECT_TRIGGER_CLASSNAME = "h-10 rounded-md border-border/60 bg-background";

function getChatPath(chatId: string) {
  return `${appRoutes.chat}/${chatId}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function DashboardChatCard() {
  const navigate = useNavigate();
  const { data: chats = [] } = useChatConversations();
  const createChat = useCreateChatConversation();
  const [selectedChatId, setSelectedChatId] = useState(NEW_CHAT_VALUE);

  useEffect(() => {
    if (selectedChatId === NEW_CHAT_VALUE) {
      return;
    }

    if (!chats.some((chat) => chat.id === selectedChatId)) {
      setSelectedChatId(NEW_CHAT_VALUE);
    }
  }, [chats, selectedChatId]);

  const openNewChat = async (initialMessage?: string) => {
    try {
      const chat = await createChat.mutateAsync();
      navigate(getChatPath(chat.id), {
        state: initialMessage ? { initialMessage } : undefined,
      });
      return true;
    } catch (error) {
      toast.error("Nao foi possivel iniciar um novo chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
      return false;
    }
  };

  const handleOpenSelectedChat = async () => {
    if (selectedChatId === NEW_CHAT_VALUE) {
      await openNewChat();
      return;
    }

    navigate(getChatPath(selectedChatId));
  };

  const handleStartConversation = async (message: string) => {
    if (selectedChatId === NEW_CHAT_VALUE) {
      return openNewChat(message);
    }

    navigate(getChatPath(selectedChatId), {
      state: { initialMessage: message },
    });
    return true;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-[28px] border border-border/40 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Chat financeiro</h2>
          <p className="text-sm text-muted-foreground">
            {chats.length
              ? "Escolha um chat existente para continuar ou inicie um novo."
              : "Envie a primeira mensagem para criar um novo chat automaticamente."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={selectedChatId} onValueChange={setSelectedChatId}>
            <SelectTrigger aria-label="Escolher conversa do chat financeiro" className={`sm:flex-1 ${INLINE_SELECT_TRIGGER_CLASSNAME}`}>
              <SelectValue placeholder="Novo chat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW_CHAT_VALUE}>Novo chat</SelectItem>
              {chats.map((chat) => (
                <SelectItem key={chat.id} value={chat.id}>
                  {chat.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => void handleOpenSelectedChat()} disabled={createChat.isPending}>
            {createChat.isPending && selectedChatId === NEW_CHAT_VALUE ? <Loader2 size={16} className="animate-spin" /> : <MessageSquarePlus size={16} />}
            {selectedChatId === NEW_CHAT_VALUE ? "Iniciar novo chat" : "Abrir chat"}
          </Button>
        </div>
      </div>

      <AiChat creatingConversation={createChat.isPending} onStartConversation={handleStartConversation} />
    </div>
  );
}
