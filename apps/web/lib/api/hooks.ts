/**
 * React Query hooks for data fetching
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query"
import { api, type APIError } from "./client"
import { toast } from "sonner"

/**
 * Generic list query hook
 */
export function useListQuery<T>(
  queryKey: string[],
  endpoint: string,
  params?: Record<string, unknown>,
  options?: Omit<UseQueryOptions<{ data: T[]; total: number }, APIError>, "queryKey" | "queryFn">
) {
  return useQuery<{ data: T[]; total: number }, APIError>({
    queryKey: [...queryKey, params],
    queryFn: () => api.get(endpoint, params),
    ...options,
  })
}

/**
 * Generic detail query hook
 */
export function useDetailQuery<T>(
  queryKey: string[],
  endpoint: string,
  id: string | number | null | undefined,
  options?: Omit<UseQueryOptions<T, APIError>, "queryKey" | "queryFn">
) {
  return useQuery<T, APIError>({
    queryKey: [...queryKey, id],
    queryFn: () => api.get(`${endpoint}/${id}`),
    enabled: !!id,
    ...options,
  })
}

/**
 * Generic create mutation hook
 */
export function useCreateMutation<TData, TVariables>(
  queryKey: string[],
  endpoint: string,
  options?: Omit<UseMutationOptions<TData, APIError, TVariables, unknown>, "mutationFn" | "onSuccess" | "onError">
) {
  const queryClient = useQueryClient()
  
  return useMutation<TData, APIError, TVariables, unknown>({
    mutationFn: (data: TVariables) => api.post(endpoint, data),
    onSuccess: () => {
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey })
      toast.success("Created successfully")
    },
    onError: (error) => {
      toast.error(error.message)
    },
    ...options,
  })
}

/**
 * Generic update mutation hook
 */
export function useUpdateMutation<TData, TVariables extends { id: string | number }>(
  queryKey: string[],
  endpoint: string,
  options?: Omit<UseMutationOptions<TData, APIError, TVariables, unknown>, "mutationFn" | "onSuccess" | "onError">
) {
  const queryClient = useQueryClient()
  
  return useMutation<TData, APIError, TVariables, unknown>({
    mutationFn: ({ id, ...data }: TVariables) => api.patch(`${endpoint}/${id}`, data),
    onSuccess: (_data, variables) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: [...queryKey, variables.id] })
      toast.success("Updated successfully")
    },
    onError: (error) => {
      toast.error(error.message)
    },
    ...options,
  })
}

/**
 * Generic delete mutation hook
 */
export function useDeleteMutation(
  queryKey: string[],
  endpoint: string,
  options?: Omit<UseMutationOptions<void, APIError, string | number, unknown>, "mutationFn" | "onSuccess" | "onError">
) {
  const queryClient = useQueryClient()
  
  return useMutation<void, APIError, string | number, unknown>({
    mutationFn: (id: string | number) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast.success("Deleted successfully")
    },
    onError: (error) => {
      toast.error(error.message)
    },
    ...options,
  })
}
