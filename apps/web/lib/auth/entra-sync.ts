/**
 * Entra ID Sync Utilities
 * Sync user data to Microsoft Entra ID via Graph API
 */

import { getEntraConfig } from "./entra-config"

interface GraphUser {
  id: string
  displayName: string
  mail: string
  userPrincipalName: string
  givenName?: string
  surname?: string
  jobTitle?: string
  department?: string
  officeLocation?: string
  mobilePhone?: string
  accountEnabled?: boolean
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

/**
 * Get an access token for Microsoft Graph using client credentials
 */
async function getGraphAccessToken(): Promise<string | null> {
  const config = await getEntraConfig()
  
  if (!config) {
    console.error("Entra config not available")
    return null
  }

  const { tenantId, clientId, clientSecret } = config

  try {
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          scope: "https://graph.microsoft.com/.default",
          client_secret: clientSecret,
          grant_type: "client_credentials",
        }),
      }
    )

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json()
      console.error("Failed to get Graph access token:", error)
      return null
    }

    const data: TokenResponse = await tokenResponse.json()
    return data.access_token
  } catch (error) {
    console.error("Error getting Graph access token:", error)
    return null
  }
}

/**
 * Find a user in Entra ID by email
 */
export async function findEntraUserByEmail(email: string): Promise<GraphUser | null> {
  const accessToken = await getGraphAccessToken()
  
  if (!accessToken) {
    return null
  }

  try {
    // Search by mail or userPrincipalName
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users?$filter=mail eq '${encodeURIComponent(email)}' or userPrincipalName eq '${encodeURIComponent(email)}'&$select=id,displayName,mail,userPrincipalName,givenName,surname,jobTitle,department`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Failed to find user in Entra:", error)
      return null
    }

    const data = await response.json()
    return data.value?.[0] || null
  } catch (error) {
    console.error("Error finding user in Entra:", error)
    return null
  }
}

/**
 * Get a user from Entra ID by their Entra ID (object ID)
 */
export async function getEntraUser(entraUserId: string): Promise<GraphUser | null> {
  const accessToken = await getGraphAccessToken()
  
  if (!accessToken) {
    return null
  }

  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${entraUserId}?$select=id,displayName,mail,userPrincipalName,givenName,surname,jobTitle,department,mobilePhone,accountEnabled`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      const error = await response.json()
      console.error("Failed to get user from Entra:", error)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting user from Entra:", error)
    return null
  }
}

/**
 * Update a user in Entra ID
 * Note: Requires User.ReadWrite.All permission in the app registration
 */
export async function updateEntraUser(
  entraUserId: string,
  updates: {
    displayName?: string
    givenName?: string
    surname?: string
    jobTitle?: string
    department?: string
    mobilePhone?: string
    accountEnabled?: boolean
  }
): Promise<boolean> {
  const accessToken = await getGraphAccessToken()
  
  if (!accessToken) {
    return false
  }

  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${entraUserId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Failed to update user in Entra:", error)
      return false
    }

    console.log(`Updated user ${entraUserId} in Entra ID`)
    return true
  } catch (error) {
    console.error("Error updating user in Entra:", error)
    return false
  }
}

/**
 * Sync a user's details to Entra ID
 * This is the main function to call when updating a user
 */
export async function syncUserToEntra(
  userEmail: string,
  userData: {
    name?: string
    status?: string
    role?: string
    phone?: string
  }
): Promise<{ success: boolean; message: string }> {
  // Get Entra config and check if SCIM is enabled
  const config = await getEntraConfig()
  
  if (!config) {
    return { success: false, message: "Entra ID not configured" }
  }

  if (!config.scimEnabled) {
    return { success: false, message: "SCIM sync is not enabled" }
  }

  if (config.status !== "connected") {
    return { success: false, message: "Entra ID integration is not connected" }
  }

  // Find the user in Entra by email
  const entraUser = await findEntraUserByEmail(userEmail)
  
  if (!entraUser) {
    return { success: false, message: "User not found in Entra ID" }
  }

  // Build update payload
  const updates: Record<string, unknown> = {}

  if (userData.name) {
    updates.displayName = userData.name
    // Try to split name into given/surname
    const nameParts = userData.name.trim().split(" ")
    if (nameParts.length >= 2) {
      updates.givenName = nameParts[0]
      updates.surname = nameParts.slice(1).join(" ")
    }
  }

  if (userData.phone) {
    updates.mobilePhone = userData.phone
  }

  // Sync status - map to accountEnabled
  if (userData.status) {
    updates.accountEnabled = userData.status === "active"
  }

  // Only update if there are changes
  if (Object.keys(updates).length === 0) {
    return { success: true, message: "No changes to sync" }
  }

  // Update the user in Entra
  const success = await updateEntraUser(entraUser.id, updates)
  
  if (success) {
    return { success: true, message: `Synced user ${userEmail} to Entra ID` }
  } else {
    return { success: false, message: "Failed to update user in Entra ID" }
  }
}

/**
 * Check if Entra sync is available and enabled
 */
export async function isEntraSyncEnabled(): Promise<boolean> {
  const config = await getEntraConfig()
  return config !== null && config.scimEnabled && config.status === "connected"
}

