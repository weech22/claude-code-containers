import { logWithContext } from "./log";

// GitHub API client with authentication
export class GitHubAPI {
  private configDO: any;

  constructor(configDO: any) {
    this.configDO = configDO;
  }

  async makeAuthenticatedRequest(path: string, options: RequestInit = {}): Promise<Response> {
    logWithContext('GITHUB_API', 'Making authenticated request', { path, method: options.method || 'GET' });

    const tokenResponse = await this.configDO.fetch(new Request('http://internal/get-installation-token'));
    const tokenData = await tokenResponse.json() as { token: string };

    if (!tokenData.token) {
      logWithContext('GITHUB_API', 'No installation token available');
      throw new Error('No valid installation token available');
    }

    const headers = {
      'Authorization': `Bearer ${tokenData.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Worker-GitHub-Integration',
      ...options.headers
    };

    const url = `https://api.github.com${path}`;
    logWithContext('GITHUB_API', 'Sending request to GitHub', { url, headers: Object.keys(headers) });

    const response = await fetch(url, {
      ...options,
      headers
    });

    logWithContext('GITHUB_API', 'GitHub API response', {
      status: response.status,
      statusText: response.statusText,
      path
    });

    return response;
  }

  // Get repository information
  async getRepository(owner: string, repo: string) {
    const response = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}`);
    return response.json();
  }

  // Comment on an issue or pull request
  async createComment(owner: string, repo: string, issueNumber: number, body: string) {
    const response = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
    return response.json();
  }

  // Get installation repositories
  async getInstallationRepositories() {
    const response = await this.makeAuthenticatedRequest('/installation/repositories');
    return response.json();
  }

  // Branch Operations
  async createBranch(owner: string, repo: string, branchName: string, baseSha: string): Promise<void> {
    logWithContext('GITHUB_API', 'Creating branch', { owner, repo, branchName, baseSha });
    
    const response = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha
      })
    });

    if (!response.ok) {
      const error = await response.text();
      logWithContext('GITHUB_API', 'Failed to create branch', { status: response.status, error });
      throw new Error(`Failed to create branch: ${response.status} ${error}`);
    }
  }

  // Get default branch SHA
  async getDefaultBranchSha(owner: string, repo: string): Promise<string> {
    logWithContext('GITHUB_API', 'Getting default branch SHA', { owner, repo });
    
    const repoResponse = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}`);
    const repoData = await repoResponse.json() as any;
    const defaultBranch = repoData.default_branch;

    const branchResponse = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}/branches/${defaultBranch}`);
    const branchData = await branchResponse.json() as any;
    
    return branchData.commit.sha;
  }

  // PR Operations
  async createPullRequest(owner: string, repo: string, title: string, body: string, head: string, base: string): Promise<any> {
    logWithContext('GITHUB_API', 'Creating pull request', { owner, repo, title, head, base });
    
    const response = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        head,
        base
      })
    });

    if (!response.ok) {
      const error = await response.text();
      logWithContext('GITHUB_API', 'Failed to create pull request', { status: response.status, error });
      throw new Error(`Failed to create pull request: ${response.status} ${error}`);
    }

    return response.json();
  }

  // Update file content
  async updateFile(owner: string, repo: string, path: string, content: string, message: string, branch: string, sha?: string): Promise<any> {
    logWithContext('GITHUB_API', 'Updating file', { owner, repo, path, branch });
    
    const body: any = {
      message,
      content: btoa(content), // Base64 encode content
      branch
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      logWithContext('GITHUB_API', 'Failed to update file', { status: response.status, error });
      throw new Error(`Failed to update file: ${response.status} ${error}`);
    }

    return response.json();
  }

  // Get file content
  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<{ content: string; sha: string } | null> {
    logWithContext('GITHUB_API', 'Getting file content', { owner, repo, path, ref });
    
    const url = `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`;
    const response = await this.makeAuthenticatedRequest(url);

    if (response.status === 404) {
      return null; // File doesn't exist
    }

    if (!response.ok) {
      const error = await response.text();
      logWithContext('GITHUB_API', 'Failed to get file content', { status: response.status, error });
      throw new Error(`Failed to get file content: ${response.status} ${error}`);
    }

    const data = await response.json() as any;
    return {
      content: atob(data.content), // Base64 decode content
      sha: data.sha
    };
  }
}