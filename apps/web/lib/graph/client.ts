/**
 * Microsoft Graph API Client
 * 
 * Shared utility for interacting with Microsoft Graph API.
 * Uses the Entra ID configuration from the database for authentication.
 */

import { getEntraConfig } from "@/lib/auth/entra-config"

// ============================================================================
// TYPES
// ============================================================================

export interface GraphAccessToken {
  token: string
  expiresAt: Date
}

export interface DriveItem {
  id: string
  name: string
  webUrl: string
  size: number
  createdDateTime: string
  lastModifiedDateTime: string
  file?: {
    mimeType: string
  }
  "@microsoft.graph.downloadUrl"?: string
}

export interface SharePointSite {
  id: string
  name: string
  displayName: string
  webUrl: string
}

export interface SharePointDrive {
  id: string
  name: string
  driveType: string
  webUrl: string
}

export interface GraphError {
  code: string
  message: string
  innerError?: {
    code?: string
    message?: string
    date?: string
    "request-id"?: string
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Get Microsoft Graph access token using client credentials flow
 * Uses the Entra ID configuration stored in the database
 */
export async function getGraphAccessToken(): Promise<string | null> {
  const config = await getEntraConfig()
  
  if (!config) {
    console.error("[Graph] Entra config not available")
    return null
  }

  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          scope: "https://graph.microsoft.com/.default",
          client_secret: config.clientSecret,
          grant_type: "client_credentials",
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("[Graph] Failed to get access token:", error)
      return null
    }

    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error("[Graph] Error getting access token:", error)
    return null
  }
}

// ============================================================================
// SHAREPOINT SITE OPERATIONS
// ============================================================================

/**
 * Get SharePoint site by URL
 * @param siteUrl - SharePoint site URL (e.g., "contoso.sharepoint.com/sites/hr")
 */
export async function getSiteByUrl(siteUrl: string): Promise<SharePointSite | null> {
  const token = await getGraphAccessToken()
  if (!token) return null

  try {
    // Extract hostname and site path from URL
    const url = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`)
    const hostname = url.hostname
    const sitePath = url.pathname

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("[Graph] Failed to get site:", error)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("[Graph] Error getting site:", error)
    return null
  }
}

/**
 * Get default document library (drive) for a site
 */
export async function getSiteDrive(siteId: string): Promise<SharePointDrive | null> {
  const token = await getGraphAccessToken()
  if (!token) return null

  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("[Graph] Failed to get site drive:", error)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("[Graph] Error getting site drive:", error)
    return null
  }
}

/**
 * Get all document libraries (drives) for a site
 */
export async function getSiteDrives(siteId: string): Promise<SharePointDrive[]> {
  const token = await getGraphAccessToken()
  if (!token) return []

  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("[Graph] Failed to get site drives:", error)
      return []
    }

    const data = await response.json()
    return data.value || []
  } catch (error) {
    console.error("[Graph] Error getting site drives:", error)
    return []
  }
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Upload a file to SharePoint
 * For files up to 4MB, uses simple upload. Larger files need resumable upload.
 * 
 * @param siteId - SharePoint site ID
 * @param driveId - Document library drive ID (optional, uses default drive if not provided)
 * @param folderPath - Folder path within the drive (e.g., "HR/Employees")
 * @param fileName - Name of the file
 * @param content - File content as ArrayBuffer
 * @param mimeType - MIME type of the file
 */
export async function uploadFile(
  siteId: string,
  driveId: string | null,
  folderPath: string,
  fileName: string,
  content: ArrayBuffer,
  mimeType: string
): Promise<DriveItem | null> {
  const token = await getGraphAccessToken()
  if (!token) return null

  try {
    // Clean up path - remove leading/trailing slashes
    const cleanPath = folderPath.replace(/^\/|\/$/g, "")
    const fullPath = cleanPath ? `${cleanPath}/${fileName}` : fileName
    
    // Build the URL based on whether we have a specific drive ID
    let uploadUrl: string
    if (driveId) {
      uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${fullPath}:/content`
    } else {
      uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${fullPath}:/content`
    }

    console.log(`[Graph] Uploading file to: ${uploadUrl}`)

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: content,
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("[Graph] Failed to upload file:", error)
      throw new Error(error.error?.message || "Upload failed")
    }

    const driveItem: DriveItem = await response.json()
    console.log(`[Graph] File uploaded successfully: ${driveItem.id}`)
    return driveItem
  } catch (error) {
    console.error("[Graph] Error uploading file:", error)
    throw error
  }
}

/**
 * Create a folder in SharePoint (creates parent folders if needed)
 * 
 * @param siteId - SharePoint site ID
 * @param driveId - Document library drive ID (optional)
 * @param folderPath - Full folder path to create
 */
export async function createFolder(
  siteId: string,
  driveId: string | null,
  folderPath: string
): Promise<DriveItem | null> {
  const token = await getGraphAccessToken()
  if (!token) return null

  try {
    // Clean up path
    const cleanPath = folderPath.replace(/^\/|\/$/g, "")
    
    // Build the URL
    let createUrl: string
    if (driveId) {
      createUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${cleanPath}:/children`
    } else {
      createUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${cleanPath}:/children`
    }

    // Try to get the folder first to see if it exists
    const checkUrl = driveId
      ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${cleanPath}`
      : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${cleanPath}`

    const checkResponse = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (checkResponse.ok) {
      // Folder already exists
      return await checkResponse.json()
    }

    // Create the folder using PATCH to ensure parent folders are created
    const parentPath = cleanPath.split("/").slice(0, -1).join("/")
    const folderName = cleanPath.split("/").pop() || cleanPath

    const parentUrl = parentPath
      ? (driveId
          ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${parentPath}:/children`
          : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${parentPath}:/children`)
      : (driveId
          ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/children`
          : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`)

    const response = await fetch(parentUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      // If conflict (folder exists), try to get it
      if (error.error?.code === "nameAlreadyExists") {
        const existingResponse = await fetch(checkUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (existingResponse.ok) {
          return await existingResponse.json()
        }
      }
      console.error("[Graph] Failed to create folder:", error)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("[Graph] Error creating folder:", error)
    return null
  }
}

/**
 * Get a file/folder by path
 */
export async function getItemByPath(
  siteId: string,
  driveId: string | null,
  itemPath: string
): Promise<DriveItem | null> {
  const token = await getGraphAccessToken()
  if (!token) return null

  try {
    const cleanPath = itemPath.replace(/^\/|\/$/g, "")
    
    const url = driveId
      ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${cleanPath}`
      : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${cleanPath}`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("[Graph] Error getting item:", error)
    return null
  }
}

/**
 * Get a file/folder by item ID
 */
export async function getItemById(
  siteId: string,
  driveId: string | null,
  itemId: string,
  includeDownloadUrl = false
): Promise<DriveItem | null> {
  const token = await getGraphAccessToken()
  if (!token) return null

  try {
    let url: string
    if (driveId) {
      url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}`
    } else {
      url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${itemId}`
    }

    // Select fields to include download URL if requested
    if (includeDownloadUrl) {
      url += "?select=id,name,webUrl,size,createdDateTime,lastModifiedDateTime,file,@microsoft.graph.downloadUrl"
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("[Graph] Failed to get item:", error)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("[Graph] Error getting item:", error)
    return null
  }
}

/**
 * Get download URL for a file
 * Returns a pre-authenticated URL that can be used to download the file
 */
export async function getDownloadUrl(
  siteId: string,
  driveId: string | null,
  itemId: string
): Promise<{ downloadUrl: string; expiresAt: Date } | null> {
  const item = await getItemById(siteId, driveId, itemId, true)
  
  if (!item || !item["@microsoft.graph.downloadUrl"]) {
    return null
  }

  return {
    downloadUrl: item["@microsoft.graph.downloadUrl"],
    // Download URLs typically expire in ~1 hour
    expiresAt: new Date(Date.now() + 3600000),
  }
}

/**
 * Delete a file/folder
 */
export async function deleteItem(
  siteId: string,
  driveId: string | null,
  itemId: string
): Promise<boolean> {
  const token = await getGraphAccessToken()
  if (!token) return false

  try {
    const url = driveId
      ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}`
      : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${itemId}`

    const response = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })

    return response.ok || response.status === 204
  } catch (error) {
    console.error("[Graph] Error deleting item:", error)
    return false
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Test SharePoint connection by attempting to access the site
 */
export async function testSharePointConnection(siteUrl: string): Promise<{
  success: boolean
  site?: SharePointSite
  drive?: SharePointDrive
  error?: string
}> {
  try {
    const token = await getGraphAccessToken()
    if (!token) {
      return {
        success: false,
        error: "Failed to get access token. Please check Entra ID configuration.",
      }
    }

    const site = await getSiteByUrl(siteUrl)
    if (!site) {
      return {
        success: false,
        error: "Could not access SharePoint site. Please check the site URL and permissions.",
      }
    }

    const drive = await getSiteDrive(site.id)
    if (!drive) {
      return {
        success: false,
        error: "Could not access document library. Please check permissions.",
        site,
      }
    }

    return {
      success: true,
      site,
      drive,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
