/// <reference types="vite/client" />

interface PluggyConnectWidgetResult {
  item?: { id: string };
  itemId?: string;
}

interface PluggyConnectOptions {
  connectToken: string;
  onSuccess?: (result: PluggyConnectWidgetResult) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

interface PluggyConnectInstance {
  init(containerElement?: Element): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
  destroy(): Promise<void>;
}

interface PluggyConnectConstructor {
  new (options: PluggyConnectOptions): PluggyConnectInstance;
}

interface Window {
  PluggyConnect?: PluggyConnectConstructor;
}
