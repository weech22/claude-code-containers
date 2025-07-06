import { logWithContext } from "../../log";

// Handle installation events (app installed/uninstalled)
export async function handleInstallationEvent(data: any, configDO: any): Promise<Response> {
  const action = data.action;
  const installation = data.installation;

  logWithContext('INSTALLATION_EVENT', 'Processing installation event', {
    action,
    installationId: installation?.id,
    account: installation?.account?.login,
    accountType: installation?.account?.type
  });

  if (action === 'created') {
    // App was installed - update configuration with installation details
    const repositories = data.repositories || [];
    const repoData = repositories.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private
    }));

    logWithContext('INSTALLATION_EVENT', 'Updating installation configuration', {
      repositoryCount: repositories.length,
      repositories: repoData.map((r: any) => r.full_name)
    });

    const updateResponse = await configDO.fetch(new Request('http://internal/update-installation', {
      method: 'POST',
      body: JSON.stringify({
        installationId: installation.id.toString(),
        repositories: repoData,
        owner: {
          login: installation.account.login,
          type: installation.account.type,
          id: installation.account.id
        }
      })
    }));

    logWithContext('INSTALLATION_EVENT', 'App installed successfully', {
      repositoryCount: repositories.length,
      updateResponseStatus: updateResponse.status
    });
  } else if (action === 'deleted') {
    // App was uninstalled - could clean up or mark as inactive
    logWithContext('INSTALLATION_EVENT', 'App installation removed', {
      installationId: installation?.id
    });
  } else {
    logWithContext('INSTALLATION_EVENT', 'Unhandled installation action', { action });
  }

  return new Response('Installation event processed', { status: 200 });
}