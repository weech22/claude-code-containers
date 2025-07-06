// Handle repository changes (repos added/removed from installation)
export async function handleInstallationRepositoriesEvent(data: any, configDO: any): Promise<Response> {
  const action = data.action;

  if (action === 'added') {
    const addedRepos = data.repositories_added || [];
    for (const repo of addedRepos) {
      await configDO.fetch(new Request('http://internal/add-repository', {
        method: 'POST',
        body: JSON.stringify({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private
        })
      }));
    }
    console.log(`Added ${addedRepos.length} repositories`);
  } else if (action === 'removed') {
    const removedRepos = data.repositories_removed || [];
    for (const repo of removedRepos) {
      await configDO.fetch(new Request(`http://internal/remove-repository/${repo.id}`, {
        method: 'DELETE'
      }));
    }
    console.log(`Removed ${removedRepos.length} repositories`);
  }

  return new Response('Repository changes processed', { status: 200 });
}