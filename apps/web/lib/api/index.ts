/**
 * API client exports
 */

export { api, apiClient, buildAPIURL, createCRUDClient, APIError } from "./client"
export { QueryProvider } from "./query-provider"
export { 
  useListQuery, 
  useDetailQuery, 
  useCreateMutation, 
  useUpdateMutation, 
  useDeleteMutation 
} from "./hooks"

