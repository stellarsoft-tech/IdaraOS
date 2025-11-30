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
  params?: Record<string, any>,
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
  options?: UseMutationOptions<TData, APIError, TVariables>
) {
  const queryClient = useQueryClient()
  
  return useMutation<TData, APIError, TVariables>({
    mutationFn: (data: TVariables) => api.post(endpoint, data),
    onSuccess: (data, variables, context) => {
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey })
      toast.success("Created successfully")
      options?.onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      toast.error(error.message)
      options?.onError?.(error, variables, context)
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
  options?: UseMutationOptions<TData, APIError, TVariables>
) {
  const queryClient = useQueryClient()
  
  return useMutation<TData, APIError, TVariables>({
    mutationFn: ({ id, ...data }: TVariables) => api.patch(`${endpoint}/${id}`, data),
    onSuccess: (data, variables, context) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: [...queryKey, variables.id] })
      toast.success("Updated successfully")
      options?.onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      toast.error(error.message)
      options?.onError?.(error, variables, context)
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
  options?: UseMutationOptions<void, APIError, string | number>
) {
  const queryClient = useQueryClient()
  
  return useMutation<void, APIError, string | number>({
    mutationFn: (id: string | number) => api.delete(`${endpoint}/${id}`),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey })
      toast.success("Deleted successfully")
      options?.onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      toast.error(error.message)
      options?.onError?.(error, variables, context)
    },
    ...options,
  })
}

