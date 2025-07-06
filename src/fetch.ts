import { Container } from '@cloudflare/containers';
import { logWithContext } from './log';

export interface ContainerFetchOptions {
  containerName?: string;
  route?: string;
  timeout?: number;
}

/**
 * Wrapper for container.fetch calls with enhanced logging, error handling, and timing
 */
export async function containerFetch(
  container: DurableObjectStub<Container<unknown>> | Container<unknown>,
  request: Request,
  options: ContainerFetchOptions = {}
): Promise<Response> {
  const { containerName = 'unknown', route = 'unknown', timeout = 300000 } = options;
  const startTime = Date.now();
  
  logWithContext('CONTAINER_FETCH', `Starting fetch to ${containerName} for route ${route}`, {
    url: request.url,
    method: request.method,
    containerName,
    route
  });

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Container fetch timeout after ${timeout}ms`)), timeout);
    });

    // Race between the actual fetch and timeout
    const response = await Promise.race([
      container.fetch(request),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;
    
    logWithContext('CONTAINER_FETCH', `Container fetch completed successfully`, {
      containerName,
      route,
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logWithContext('CONTAINER_FETCH', `Container fetch failed`, {
      containerName,
      route,
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    });

    // Return a proper error response instead of throwing
    return new Response(
      JSON.stringify({
        error: `Container fetch failed`,
        message: error instanceof Error ? error.message : String(error),
        containerName,
        route
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

/**
 * Helper function to extract route information from request URL
 */
export function getRouteFromRequest(request: Request): string {
  try {
    const url = new URL(request.url);
    return url.pathname;
  } catch {
    return 'unknown';
  }
}