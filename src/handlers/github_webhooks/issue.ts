import { GitHubAPI } from "../../github_client";
import { logWithContext } from "../../log";
import { containerFetch, getRouteFromRequest } from "../../fetch";

// Simplified container response interface
interface ContainerResponse {
  success: boolean;
  message: string;
  error?: string;
}

// Route GitHub issue to Claude Code container
async function routeToClaudeCodeContainer(issue: any, repository: any, env: any, configDO: any): Promise<void> {
  const containerName = `claude-issue-${issue.id}`;

  logWithContext('CLAUDE_ROUTING', 'Routing issue to Claude Code container', {
    issueNumber: issue.number,
    issueId: issue.id,
    containerName,
    repository: repository.full_name
  });

  // Create unique container for this issue
  const id = env.MY_CONTAINER.idFromName(containerName);
  const container = env.MY_CONTAINER.get(id);

  // Get installation token for GitHub API access
  logWithContext('CLAUDE_ROUTING', 'Retrieving installation token');

  const tokenResponse = await configDO.fetch(new Request('http://internal/get-installation-token'));
  const tokenData = await tokenResponse.json() as { token: string };

  logWithContext('CLAUDE_ROUTING', 'Installation token retrieved', {
    hasToken: !!tokenData.token
  });

  // Get Claude API key from secure storage
  logWithContext('CLAUDE_ROUTING', 'Retrieving Claude API key');

  const claudeConfigId = env.GITHUB_APP_CONFIG.idFromName('claude-config');
  const claudeConfigDO = env.GITHUB_APP_CONFIG.get(claudeConfigId);
  const claudeKeyResponse = await claudeConfigDO.fetch(new Request('http://internal/get-claude-key'));
  const claudeKeyData = await claudeKeyResponse.json() as { anthropicApiKey: string | null };

  logWithContext('CLAUDE_ROUTING', 'Claude API key check', {
    hasApiKey: !!claudeKeyData.anthropicApiKey
  });

  if (!claudeKeyData.anthropicApiKey) {
    logWithContext('CLAUDE_ROUTING', 'Claude API key not configured');
    throw new Error('Claude API key not configured. Please visit /claude-setup first.');
  }

  // Prepare environment variables for the container
  const issueContext = {
    ANTHROPIC_API_KEY: claudeKeyData.anthropicApiKey,
    GITHUB_TOKEN: tokenData.token,
    ISSUE_ID: issue.id.toString(),
    ISSUE_NUMBER: issue.number.toString(),
    ISSUE_TITLE: issue.title,
    ISSUE_BODY: issue.body || '',
    ISSUE_LABELS: JSON.stringify(issue.labels?.map((label: any) => label.name) || []),
    REPOSITORY_URL: repository.clone_url,
    REPOSITORY_NAME: repository.full_name,
    ISSUE_AUTHOR: issue.user.login,
    MESSAGE: `Processing issue #${issue.number}: ${issue.title}`
  };

  // Start Claude Code processing by calling the container
  logWithContext('CLAUDE_ROUTING', 'Starting Claude Code container processing', {
    containerName,
    issueId: issueContext.ISSUE_ID
  });

  try {
    const response = await containerFetch(container, new Request('http://internal/process-issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(issueContext)
    }), {
      containerName,
      route: '/process-issue'
    });

    logWithContext('CLAUDE_ROUTING', 'Claude Code container response', {
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      logWithContext('CLAUDE_ROUTING', 'Container returned error', {
        status: response.status,
        errorText
      });
      throw new Error(`Container returned status ${response.status}: ${errorText}`);
    }

    // Parse container response
    const containerResponse: ContainerResponse = await response.json();
    
    logWithContext('CLAUDE_ROUTING', 'Container response parsed', {
      success: containerResponse.success,
      message: containerResponse.message,
      hasError: !!containerResponse.error
    });

    if (containerResponse.success) {
      logWithContext('CLAUDE_ROUTING', 'Container processing completed successfully', {
        message: containerResponse.message
      });
    } else {
      logWithContext('CLAUDE_ROUTING', 'Container processing failed', {
        error: containerResponse.error
      });
    }

  } catch (error) {
    logWithContext('CLAUDE_ROUTING', 'Failed to process Claude Code response', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Handle issues events
export async function handleIssuesEvent(data: any, env: any, configDO: any): Promise<Response> {
  const action = data.action;
  const issue = data.issue;
  const repository = data.repository;

  logWithContext('ISSUES_EVENT', 'Processing issue event', {
    action,
    issueNumber: issue.number,
    issueTitle: issue.title,
    repository: repository.full_name,
    author: issue.user?.login,
    labels: issue.labels?.map((label: any) => label.name) || []
  });

  // Create GitHub API client for authenticated requests
  const githubAPI = new GitHubAPI(configDO);

  // Handle new issue creation with Claude Code
  if (action === 'opened') {
    logWithContext('ISSUES_EVENT', 'Handling new issue creation');

    try {
      // Post initial acknowledgment comment
      logWithContext('ISSUES_EVENT', 'Posting initial acknowledgment comment');

      await githubAPI.createComment(
        repository.owner.login,
        repository.name,
        issue.number,
        `🤖 **Claude Code Assistant**\n\nI've received this issue and I'm analyzing it now. I'll start working on a solution shortly!\n\n---\n🚀 Powered by Claude Code`
      );

      logWithContext('ISSUES_EVENT', 'Initial comment posted successfully');

      // Route to Claude Code container for processing
      logWithContext('ISSUES_EVENT', 'Routing to Claude Code container');
      await routeToClaudeCodeContainer(issue, repository, env, configDO);

      logWithContext('ISSUES_EVENT', 'Issue routed to Claude Code container successfully');

    } catch (error) {
      logWithContext('ISSUES_EVENT', 'Failed to process new issue', {
        error: error instanceof Error ? error.message : String(error),
        issueNumber: issue.number
      });

      // Post error comment
      try {
        logWithContext('ISSUES_EVENT', 'Posting error comment to issue');

        await githubAPI.createComment(
          repository.owner.login,
          repository.name,
          issue.number,
          `❌ I encountered an error while setting up to work on this issue: ${(error as Error).message}\n\nI'll need human assistance to resolve this.`
        );

        logWithContext('ISSUES_EVENT', 'Error comment posted successfully');
      } catch (commentError) {
        logWithContext('ISSUES_EVENT', 'Failed to post error comment', {
          commentError: commentError instanceof Error ? commentError.message : String(commentError)
        });
      }
    }
  }

  // For other issue actions, use the standard container routing
  const containerName = `repo-${repository.id}`;
  const id = env.MY_CONTAINER.idFromName(containerName);
  const container = env.MY_CONTAINER.get(id);

  const webhookPayload = {
    event: 'issues',
    action,
    repository: repository.full_name,
    issue_number: issue.number,
    issue_title: issue.title,
    issue_author: issue.user.login
  };

  await containerFetch(container, new Request('http://internal/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(webhookPayload)
  }), {
    containerName,
    route: '/webhook'
  });

  return new Response('Issues event processed', { status: 200 });
}