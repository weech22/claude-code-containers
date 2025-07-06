import { logWithContext } from "../log";

function generateAppManifest(workerDomain: string): GitHubAppManifest {
  return {
    name: `Claude Code on Cloudflare`,
    url: workerDomain,
    hook_attributes: {
      url: `${workerDomain}/webhooks/github`
    },
    redirect_url: `${workerDomain}/gh-setup/callback`,
    callback_urls: [`${workerDomain}/gh-setup/callback`],
    setup_url: `${workerDomain}`,
    public: false,
    default_permissions: {
      contents: 'write',
      metadata: 'read',
      pull_requests: 'write',
      issues: 'write'
    },
    default_events: [
      'issues'
    ]
  };
}

export async function handleGitHubSetup(_request: Request, origin: string): Promise<Response> {
  logWithContext('GITHUB_SETUP', 'Handling GitHub setup request', { origin });

  const webhookUrl = `${origin}/webhooks/github`;
  const manifest = generateAppManifest(origin);
  const manifestJson = JSON.stringify(manifest);

  logWithContext('GITHUB_SETUP', 'Generated GitHub App manifest', {
    webhookUrl,
    appName: manifest.name
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>GitHub App Setup - Cloudflare Worker</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .webhook-info {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .webhook-url {
            font-family: monospace;
            background: #fff;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            word-break: break-all;
        }
        .create-app-btn {
            background: #238636;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            cursor: pointer;
            font-size: 14px;
        }
        .create-app-btn:hover {
            background: #2ea043;
        }
        .steps {
            margin: 30px 0;
        }
        .step {
            margin: 15px 0;
            padding-left: 30px;
            position: relative;
        }
        .step-number {
            position: absolute;
            left: 0;
            top: 0;
            background: #0969da;
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>GitHub App Setup</h1>
        <p>Configure GitHub webhook integration for your Cloudflare Worker</p>
    </div>

    <div class="webhook-info">
        <h3>Your Webhook URL</h3>
        <div class="webhook-url">${webhookUrl}</div>
        <p>This URL will receive GitHub webhook events once setup is complete.</p>
    </div>

    <div class="steps">
        <h3>Setup Steps</h3>

        <div class="step">
            <div class="step-number">1</div>
            <strong>Create GitHub App</strong><br>
            Click the button below to create a pre-configured GitHub App with all necessary permissions and webhook settings.
        </div>

        <div class="step">
            <div class="step-number">2</div>
            <strong>Choose Account</strong><br>
            Select which GitHub account or organization should own the app.
        </div>

        <div class="step">
            <div class="step-number">3</div>
            <strong>Install App</strong><br>
            After creation, you'll be guided to install the app on your repositories.
        </div>
    </div>

    <div style="text-align: center; margin: 40px 0;">
        <form action="https://github.com/settings/apps/new" method="post" id="github-app-form">
            <input type="hidden" name="manifest" id="manifest" value="">
            <button type="submit" class="create-app-btn">
                Create GitHub App
            </button>
        </form>
    </div>

    <details>
        <summary>App Configuration Details</summary>
        <pre style="background: #f8f8f8; padding: 15px; border-radius: 4px; overflow-x: auto;">
Permissions:
- Repository contents: read
- Repository metadata: read
- Pull requests: write
- Issues: write

Webhook Events:
- issues
- installation events (automatically enabled)

Webhook URL: ${webhookUrl}
        </pre>
    </details>

    <script>
        // Set the manifest data when the page loads
        document.getElementById('manifest').value = ${JSON.stringify(manifestJson)};
    </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}