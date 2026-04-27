export interface PluggyConnection {
  id: number;
  userId: number;
  pluggyItemId: string;
  institutionName: string | null;
  institutionImageUrl: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One entry per connected bank in the status response. */
export interface PluggyConnectionItem {
  pluggyItemId: string;
  institutionName: string | null;
  institutionImageUrl: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

/** Shape returned by Pluggy's POST /auth */
export interface PluggyApiKey {
  apiKey: string;
}

/** Shape returned by Pluggy's POST /connect_token */
export interface PluggyConnectToken {
  accessToken: string;
}

/** Shape of a Pluggy Item */
export interface PluggyItem {
  id: string;
  status: "UPDATING" | "UPDATED" | "WAITING_USER_INPUT" | "LOGIN_ERROR" | "OUTDATED" | "ERROR";
  connector: {
    id: number;
    name: string;
    primaryColor: string;
    institutionUrl: string;
    country: string;
    type: string;
    imageUrl: string;
    hasMFA: boolean;
    oauth: boolean;
    oauthUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

/** Shape of a Pluggy Account */
export interface PluggyAccount {
  id: string;
  itemId: string;
  type: string;
  subtype: string;
  name: string;
  marketingName: string | null;
  balance: number;
  currencyCode: string;
  number: string | null;
  owner: string | null;
  bankData: {
    availableCreditLimit: number | null;
  } | null;
  /** Present for CREDIT accounts */
  creditData: {
    creditLimit: number | null;
    availableCreditLimit: number | null;
    balanceDueDate: string | null;
    minimumPaymentAmount: number | null;
  } | null;
}

/** Shape of a Pluggy Transaction */
export interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  descriptionRaw: string | null;
  currencyCode: string;
  amount: number;
  date: string;
  category: string | null;
  type: "CREDIT" | "DEBIT";
  status: string;
}

export interface PluggyTransactionsPage {
  total: number;
  totalPages: number;
  page: number;
  results: PluggyTransaction[];
}

/** Public-facing connection status returned to frontend */
export interface PluggyConnectionStatus {
  connected: boolean;
  connectionCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  connections: PluggyConnectionItem[];
}

/** Sync result returned to frontend */
export interface PluggySyncResult {
  imported: number;
  skipped: number;
  accounts: number;
}

