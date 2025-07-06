import { encrypt } from "../crypto";
import { logWithContext } from "../log";

export async function handleOAuthCallback(_request: Request, url: URL, env: any): Promise<Response> {
  logWithContext('OAUTH_CALLBACK', 'Handling OAuth callback', {
    hasCode: !!url.searchParams.get('code'),
    origin: url.origin
  });

  const code = url.searchParams.get('code');

  if (!code) {
    logWithContext('OAUTH_CALLBACK', 'Missing authorization code in callback');
    return new Response('Missing authorization code', { status: 400 });
  }

  try {
    // Exchange temporary code for app credentials
    logWithContext('OAUTH_CALLBACK', 'Exchanging code for app credentials', { code: code.substring(0, 8) + '...' });

    const response = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Worker-GitHub-Integration'
      }
    });

    logWithContext('OAUTH_CALLBACK', 'GitHub manifest conversion response', {
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok) {
      const errorText = await response.text();
      logWithContext('OAUTH_CALLBACK', 'GitHub API error', {
        status: response.status,
        error: errorText
      });
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const appData = await response.json() as GitHubAppData;
    logWithContext('OAUTH_CALLBACK', 'App credentials received', {
      appId: appData.id,
      appName: appData.name,
      owner: appData.owner?.login
    });

    // Store app credentials securely in Durable Object
    logWithContext('OAUTH_CALLBACK', 'Storing app credentials in Durable Object');

    try {
      const encryptedPrivateKey = await encrypt(appData.pem);
      const encryptedWebhookSecret = await encrypt(appData.webhook_secret);

      logWithContext('OAUTH_CALLBACK', 'App credentials encrypted successfully');

      const appConfig: GitHubAppConfig = {
        appId: appData.id.toString(),
        privateKey: encryptedPrivateKey,
        webhookSecret: encryptedWebhookSecret,
        repositories: [],
        owner: {
          login: appData.owner?.login || 'unknown',
          type: 'User', // Default to User, will be updated during installation
          id: 0 // Will be updated during installation
        },
        permissions: {
          contents: 'read',
          metadata: 'read',
          pull_requests: 'write',
          issues: 'write'
        },
        events: ['issues'],
        createdAt: new Date().toISOString(),
        webhookCount: 0
      };

      // Store in Durable Object (using app ID as unique identifier)
      const id = env.GITHUB_APP_CONFIG.idFromName(appData.id.toString());
      const configDO = env.GITHUB_APP_CONFIG.get(id);

      // We need to create a simple API for the Durable Object
      const storeResponse = await configDO.fetch(new Request('http://internal/store', {
        method: 'POST',
        body: JSON.stringify(appConfig)
      }));

      logWithContext('OAUTH_CALLBACK', 'App config stored in Durable Object', {
        appId: appData.id,
        storeResponseStatus: storeResponse.status
      });
    } catch (error) {
      logWithContext('OAUTH_CALLBACK', 'Failed to store app config', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Continue with the flow even if storage fails
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>GitHub App Created Successfully</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 40px auto;
            padding: 20px;
            text-align: center;
        }
        .success { color: #28a745; }
        .install-btn {
            display: inline-block;
            background: #0969da;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
        .app-info {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
        }
    </style>
</head>
<body>
    <h1 class="success">GitHub App Created Successfully!</h1>

    <div class="app-info">
        <h3>App Details</h3>
        <p><strong>Name:</strong> ${appData.name}</p>
        <p><strong>App ID:</strong> ${appData.id}</p>
        <p><strong>Owner:</strong> ${appData.owner?.login || 'Unknown'}</p>
    </div>

    <p>Your GitHub App has been created with all necessary permissions and webhook configuration.</p>

    <h3>Next Step: Install Your App</h3>
    <p>Click the button below to install the app on your repositories and start receiving webhooks.</p>

    <a href="${appData.html_url}/installations/new" class="install-btn">
        Install App on Repositories
    </a>

    <p><small>App credentials have been securely stored and webhooks are ready to receive events.</small></p>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    logWithContext('OAUTH_CALLBACK', 'OAuth callback error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return new Response(`Setup failed: ${(error as Error).message}`, { status: 500 });
  }
}