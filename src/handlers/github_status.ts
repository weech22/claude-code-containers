export async function handleGitHubStatus(_request: Request, env: any): Promise<Response> {
  const url = new URL(_request.url);
  const appId = url.searchParams.get('app_id');

  if (!appId) {
    return new Response(JSON.stringify({ error: 'Missing app_id parameter' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    });
  }

  try {
    const id = env.GITHUB_APP_CONFIG.idFromName(appId);
    const configDO = env.GITHUB_APP_CONFIG.get(id);

    const response = await configDO.fetch(new Request('http://internal/get'));
    const config = await response.json() as GitHubAppConfig | null;

    if (!config) {
      return new Response(JSON.stringify({ error: 'No configuration found for this app ID' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404
      });
    }

    // Return safe information (without sensitive data)
    const safeConfig = {
      appId: config.appId,
      owner: config.owner,
      repositories: config.repositories,
      permissions: config.permissions,
      events: config.events,
      createdAt: config.createdAt,
      lastWebhookAt: config.lastWebhookAt,
      webhookCount: config.webhookCount,
      installationId: config.installationId,
      hasCredentials: !!(config.privateKey && config.webhookSecret)
    };

    return new Response(JSON.stringify(safeConfig, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching GitHub status:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}