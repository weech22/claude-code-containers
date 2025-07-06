import { encrypt } from "../crypto";
import { logWithContext } from "../log";

export async function handleClaudeSetup(request: Request, origin: string, env: any): Promise<Response> {
  logWithContext('CLAUDE_SETUP', 'Handling Claude setup request', {
    method: request.method,
    origin
  });

  // Handle POST request to save API key
  if (request.method === 'POST') {
    logWithContext('CLAUDE_SETUP', 'Processing API key submission');

    try {
      const formData = await request.formData();
      const apiKey = formData.get('anthropic_api_key') as string;

      logWithContext('CLAUDE_SETUP', 'API key received', {
        hasApiKey: !!apiKey,
        keyPrefix: apiKey ? apiKey.substring(0, 7) + '...' : 'none'
      });

      if (!apiKey || !apiKey.startsWith('sk-ant-')) {
        logWithContext('CLAUDE_SETUP', 'Invalid API key format provided');
        throw new Error('Invalid Anthropic API key format');
      }

      // Store the API key securely in a deployment-specific Durable Object
      const deploymentId = 'claude-config'; // Single config per deployment
      logWithContext('CLAUDE_SETUP', 'Storing API key in Durable Object', { deploymentId });

      const id = env.GITHUB_APP_CONFIG.idFromName(deploymentId);
      const configDO = env.GITHUB_APP_CONFIG.get(id);

      // Encrypt the API key
      const encryptedApiKey = await encrypt(apiKey);
      logWithContext('CLAUDE_SETUP', 'API key encrypted successfully');

      // Store in Durable Object
      const storeResponse = await configDO.fetch(new Request('http://internal/store-claude-key', {
        method: 'POST',
        body: JSON.stringify({
          anthropicApiKey: encryptedApiKey,
          claudeSetupAt: new Date().toISOString()
        })
      }));

      logWithContext('CLAUDE_SETUP', 'API key stored in Durable Object', {
        storeResponseStatus: storeResponse.status
      });

      return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Setup Complete</title>
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
        .next-btn {
            display: inline-block;
            background: #0969da;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1 class="success">Claude Code API Key Configured!</h1>
    <p>Your Anthropic API key has been securely stored and encrypted.</p>
    <p>Claude Code is now ready to process GitHub issues automatically!</p>

    <a href="/gh-setup" class="next-btn">
        Setup GitHub Integration
    </a>

    <p><small>Your API key is encrypted and stored securely in Cloudflare's Durable Objects.</small></p>
</body>
</html>`, {
        headers: { 'Content-Type': 'text/html' }
      });

    } catch (error) {
      logWithContext('CLAUDE_SETUP', 'Error during Claude setup', {
        error: error instanceof Error ? error.message : String(error)
      });

      return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Setup Error</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 40px auto;
            padding: 20px;
            text-align: center;
        }
        .error { color: #dc3545; }
        .back-btn {
            display: inline-block;
            background: #6c757d;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1 class="error">❌ Setup Error</h1>
    <p>Error: ${(error as Error).message}</p>

    <a href="/claude-setup" class="back-btn">
        ← Try Again
    </a>
</body>
</html>`, {
        headers: { 'Content-Type': 'text/html' },
        status: 400
      });
    }
  }

  // Show setup form
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Setup - Anthropic API Key</title>
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
        .setup-form {
            background: #f5f5f5;
            padding: 30px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
        }
        input[type="password"] {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
            box-sizing: border-box;
        }
        .submit-btn {
            background: #28a745;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
        }
        .submit-btn:hover {
            background: #218838;
        }
        .info-box {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #2196f3;
            margin: 20px 0;
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
        .security-note {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #28a745;
            margin: 20px 0;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Claude Code Setup</h1>
        <p>Configure your Anthropic API key to enable AI-powered GitHub issue processing</p>
    </div>

    <div class="info-box">
        <h3>What you'll need</h3>
        <p>An Anthropic API key with access to Claude. You can get one from the <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a>.</p>
    </div>

    <div class="steps">
        <h3>Quick Setup Steps</h3>

        <div class="step">
            <div class="step-number">1</div>
            <strong>Get your API Key</strong><br>
            Visit <a href="https://console.anthropic.com/" target="_blank">console.anthropic.com</a> and create an API key (starts with "sk-ant-").
        </div>

        <div class="step">
            <div class="step-number">2</div>
            <strong>Enter API Key</strong><br>
            Paste your API key in the form below. It will be encrypted and stored securely.
        </div>

        <div class="step">
            <div class="step-number">3</div>
            <strong>Setup GitHub Integration</strong><br>
            After saving your key, configure GitHub to send webhooks for automatic issue processing.
        </div>
    </div>

    <form method="POST" class="setup-form">
        <div class="form-group">
            <label for="anthropic_api_key">Anthropic API Key</label>
            <input
                type="password"
                id="anthropic_api_key"
                name="anthropic_api_key"
                placeholder="sk-ant-api03-..."
                required
                pattern="sk-ant-.*"
                title="API key must start with 'sk-ant-'"
            >
        </div>

        <button type="submit" class="submit-btn">
            Save API Key Securely
        </button>
    </form>

    <div class="security-note">
        <strong>Security:</strong> Your API key is encrypted using AES-256-GCM before storage.
        Only your worker deployment can decrypt and use it. It's never logged or exposed.
    </div>

    <p><strong>Already configured?</strong> <a href="/gh-setup">Continue to GitHub Setup</a></p>

    <hr style="margin: 40px 0;">
    <p style="text-align: center;"><a href="/">Back to Home</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}