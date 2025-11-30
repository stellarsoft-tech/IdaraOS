/**
 * Type-safe API client using fetch
 * Works with any REST backend (Next.js API Routes, Express, PostgREST, etc.)
 */

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message)
    this.name = "APIError"
  }
}

export interface APIClientConfig {
  baseURL?: string
  headers?: Record<string, string>
  onError?: (error: APIError) => void
}

/**
 * Type-safe fetch wrapper
 */
export async function apiClient<T = any>(
  endpoint: string,
  options?: RequestInit & { params?: Record<string, any> }
): Promise<T> {
  const { params, ...fetchOptions } = options || {}
  
  // Build URL with query params
  const url = new URL(endpoint, process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000")
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value))
      }
    })
  }
  
  // Default headers
  const headers = new Headers(fetchOptions.headers)
  if (!headers.has("Content-Type") && fetchOptions.method !== "GET") {
    headers.set("Content-Type", "application/json")
  }
  
  try {
    const response = await fetch(url.toString(), {
      ...fetchOptions,
      headers,
    })
    
    // Handle non-2xx responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      )
    }
    
    // Handle empty responses
    if (response.status === 204) {
      return undefined as T
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(
      error instanceof Error ? error.message : "Network error",
      0,
      error
    )
  }
}

/**
 * Convenience methods
 */
export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, any>) =>
    apiClient<T>(endpoint, { method: "GET", params }),
  
  post: <T = any>(endpoint: string, data?: any) =>
    apiClient<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  put: <T = any>(endpoint: string, data?: any) =>
    apiClient<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  patch: <T = any>(endpoint: string, data?: any) =>
    apiClient<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  delete: <T = any>(endpoint: string) =>
    apiClient<T>(endpoint, { method: "DELETE" }),
}

/**
 * Build API URL from spec routing
 */
export function buildAPIURL(spec: { namespace: string; entity: string }): string {
  return `/api/${spec.namespace.replace(".", "/")}/${spec.entity}`
}

/**
 * Standard CRUD operations generator
 */
export function createCRUDClient<T extends { [key: string]: any }>(
  baseEndpoint: string,
  idField: string = "id"
) {
  return {
    list: (params?: Record<string, any>) =>
      api.get<{ data: T[]; total: number }>(`${baseEndpoint}`, params),
    
    get: (id: string | number) =>
      api.get<T>(`${baseEndpoint}/${id}`),
    
    create: (data: Partial<T>) =>
      api.post<T>(`${baseEndpoint}`, data),
    
    update: (id: string | number, data: Partial<T>) =>
      api.patch<T>(`${baseEndpoint}/${id}`, data),
    
    delete: (id: string | number) =>
      api.delete(`${baseEndpoint}/${id}`),
  }
}

