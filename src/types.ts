// GitHub App Manifest Template
interface GitHubAppManifest {
  name: string;
  url: string;
  hook_attributes: {
    url: string;
  };
  redirect_url: string;
  callback_urls: string[];
  setup_url: string;
  public: boolean;
  default_permissions: {
    contents: string;
    metadata: string;
    pull_requests: string;
    issues: string;
  };
  default_events: string[];
}

// GitHub App Data Response
interface GitHubAppData {
  id: number;
  name: string;
  html_url: string;
  owner?: {
    login: string;
  };
  pem: string;
  webhook_secret: string;
}

// Storage Interfaces for Phase 2
interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
}

interface GitHubAppConfig {
  appId: string;
  privateKey: string; // encrypted
  webhookSecret: string; // encrypted
  installationId?: string;
  repositories: Repository[];
  owner: {
    login: string;
    type: "User" | "Organization";
    id: number;
  };
  permissions: {
    contents: string;
    metadata: string;
    pull_requests: string;
    issues: string;
  };
  events: string[];
  createdAt: string;
  lastWebhookAt?: string;
  webhookCount: number;
  // Claude Code integration
  anthropicApiKey?: string; // encrypted
  claudeSetupAt?: string;
}
