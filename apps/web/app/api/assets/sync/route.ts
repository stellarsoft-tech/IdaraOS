/**
 * Asset Sync API Routes
 * POST /api/assets/sync - Trigger device sync from Microsoft Intune
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { 
  assets, 
  assetAssignments,
  assetLifecycleEvents,
  persons,
  integrations,
  assetsSettings,
} from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { decrypt } from "@/lib/encryption"

// Microsoft Graph API types
interface IntuneDevice {
  id: string
  deviceName: string
  serialNumber?: string
  manufacturer?: string
  model?: string
  operatingSystem?: string
  osVersion?: string
  complianceState?: string
  enrolledDateTime?: string
  lastSyncDateTime?: string
  userPrincipalName?: string
  userDisplayName?: string
  managedDeviceOwnerType?: string
  deviceEnrollmentType?: string
}

interface GraphResponse {
  value: IntuneDevice[]
  "@odata.nextLink"?: string
}

interface SyncSettings {
  deviceFilters?: {
    osFilter?: string[]
    complianceFilter?: string[]
  }
  categoryMapping?: {
    mappings: Array<{ deviceType: string; categoryId: string }>
    defaultCategoryId?: string
  }
  syncBehavior?: {
    autoDeleteOnRemoval: boolean
    autoCreatePeople: boolean
    updateExistingOnly: boolean
  }
}

/**
 * Get an access token for Microsoft Graph API
 */
async function getGraphAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  })
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error_description || "Failed to get access token")
  }
  
  const data = await response.json()
  return data.access_token
}

/**
 * Fetch managed devices from Microsoft Intune
 */
async function fetchManagedDevices(
  accessToken: string,
  filters?: SyncSettings["deviceFilters"]
): Promise<IntuneDevice[]> {
  const devices: IntuneDevice[] = []
  
  // Build filter query
  const filterParts: string[] = []
  if (filters?.osFilter && filters.osFilter.length > 0) {
    const osFilters = filters.osFilter.map(os => `operatingSystem eq '${os}'`)
    filterParts.push(`(${osFilters.join(" or ")})`)
  }
  if (filters?.complianceFilter && filters.complianceFilter.length > 0) {
    const complianceFilters = filters.complianceFilter.map(s => `complianceState eq '${s}'`)
    filterParts.push(`(${complianceFilters.join(" or ")})`)
  }
  
  const filterQuery = filterParts.length > 0 ? `&$filter=${encodeURIComponent(filterParts.join(" and "))}` : ""
  
  let url = `https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$select=id,deviceName,serialNumber,manufacturer,model,operatingSystem,osVersion,complianceState,enrolledDateTime,lastSyncDateTime,userPrincipalName,userDisplayName,managedDeviceOwnerType,deviceEnrollmentType${filterQuery}`
  
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || "Failed to fetch devices from Intune")
    }
    
    const data: GraphResponse = await response.json()
    devices.push(...data.value)
    url = data["@odata.nextLink"] || ""
  }
  
  return devices
}

/**
 * Map Intune device to asset record
 */
function mapDeviceToAsset(
  device: IntuneDevice,
  orgId: string,
  categoryMapping?: SyncSettings["categoryMapping"]
) {
  // Determine category based on OS
  let categoryId: string | null = null
  if (categoryMapping?.mappings && device.operatingSystem) {
    const mapping = categoryMapping.mappings.find(
      m => m.deviceType.toLowerCase() === device.operatingSystem?.toLowerCase()
    )
    categoryId = mapping?.categoryId || categoryMapping.defaultCategoryId || null
  }
  
  // Generate asset tag from device name and ID
  const shortId = device.id.substring(0, 8).toUpperCase()
  const assetTag = `INT-${shortId}`
  
  return {
    orgId,
    assetTag,
    name: device.deviceName || `Device ${shortId}`,
    categoryId,
    status: "assigned" as const, // Devices from Intune are typically assigned
    serialNumber: device.serialNumber || null,
    manufacturer: device.manufacturer || null,
    model: device.model || null,
    purchaseDate: device.enrolledDateTime ? device.enrolledDateTime.split("T")[0] : null,
    source: "intune_sync" as const,
    intuneDeviceId: device.id,
    intuneComplianceState: device.complianceState || null,
    intuneEnrollmentType: device.deviceEnrollmentType || null,
    intuneLastSyncAt: device.lastSyncDateTime ? new Date(device.lastSyncDateTime) : null,
    syncEnabled: true,
  }
}

/**
 * POST /api/assets/sync
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await requirePermission(...P.assets.settings.edit())
    const orgId = session.orgId
    
    // Get Entra integration configuration
    const integrationResult = await db
      .select()
      .from(integrations)
      .where(and(
        eq(integrations.orgId, orgId),
        eq(integrations.provider, "entra")
      ))
      .limit(1)
    
    if (integrationResult.length === 0) {
      return NextResponse.json(
        { error: "Microsoft Entra ID is not connected" },
        { status: 400 }
      )
    }
    
    const integration = integrationResult[0]
    
    if (!integration.syncDevicesEnabled) {
      return NextResponse.json(
        { error: "Device sync is not enabled" },
        { status: 400 }
      )
    }
    
    if (!integration.tenantId || !integration.clientId || !integration.clientSecretEncrypted) {
      return NextResponse.json(
        { error: "Entra ID configuration is incomplete" },
        { status: 400 }
      )
    }
    
    // Get assets settings for sync configuration
    const settingsResult = await db
      .select()
      .from(assetsSettings)
      .where(eq(assetsSettings.orgId, orgId))
      .limit(1)
    
    const syncSettings = (settingsResult[0]?.syncSettings as SyncSettings) || {}
    
    // Decrypt the client secret
    const clientSecret = decrypt(integration.clientSecretEncrypted)
    if (!clientSecret) {
      return NextResponse.json(
        { error: "Failed to decrypt client secret" },
        { status: 500 }
      )
    }
    
    // Get access token
    const accessToken = await getGraphAccessToken(
      integration.tenantId,
      integration.clientId,
      clientSecret
    )
    
    // Fetch devices from Intune
    const devices = await fetchManagedDevices(accessToken, syncSettings.deviceFilters)
    
    // Get existing assets synced from Intune
    const existingAssets = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.orgId, orgId),
        eq(assets.source, "intune_sync")
      ))
    
    const existingByIntuneId = new Map(
      existingAssets.map(a => [a.intuneDeviceId, a])
    )
    
    // Get all people for assignment lookup
    const allPeople = await db
      .select()
      .from(persons)
      .where(eq(persons.orgId, orgId))
    
    const peopleByEmail = new Map(
      allPeople.map(p => [p.email.toLowerCase(), p])
    )
    
    const now = new Date()
    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0
    let assignedCount = 0
    const errors: string[] = []
    const unmatchedEmails: string[] = []
    
    // Process each device
    for (const device of devices) {
      try {
        const existing = existingByIntuneId.get(device.id)
        const assetData = mapDeviceToAsset(device, orgId, syncSettings.categoryMapping)
        
        // Look up person by email
        let assignedToId: string | null = null
        if (device.userPrincipalName) {
          const person = peopleByEmail.get(device.userPrincipalName.toLowerCase())
          if (person) {
            assignedToId = person.id
            assignedCount++
          } else {
            // Track unmatched email for debugging
            if (!unmatchedEmails.includes(device.userPrincipalName.toLowerCase())) {
              unmatchedEmails.push(device.userPrincipalName.toLowerCase())
            }
          }
          
          if (!person && syncSettings.syncBehavior?.autoCreatePeople) {
            // Create person record
            try {
              const newPerson = await db
                .insert(persons)
                .values({
                  orgId,
                  slug: device.userPrincipalName.split("@")[0].toLowerCase(),
                  name: device.userDisplayName || device.userPrincipalName.split("@")[0],
                  email: device.userPrincipalName,
                  status: "active",
                  source: "sync",
                  startDate: new Date().toISOString().split("T")[0], // Required field - use current date
                })
                .returning()
              
              if (newPerson.length > 0) {
                assignedToId = newPerson[0].id
                assignedCount++
                peopleByEmail.set(device.userPrincipalName.toLowerCase(), newPerson[0])
                // Remove from unmatched since we created
                const idx = unmatchedEmails.indexOf(device.userPrincipalName.toLowerCase())
                if (idx > -1) unmatchedEmails.splice(idx, 1)
              }
            } catch {
              // Person creation failed, continue without assignment
            }
          }
        }
        
        // Determine assignment date from Intune enrollment date
        const intuneAssignedAt = device.enrolledDateTime 
          ? new Date(device.enrolledDateTime) 
          : now
        
        if (existing) {
          // Update existing asset
          const previousAssignedToId = existing.assignedToId
          const assignmentChanged = previousAssignedToId !== assignedToId
          
          await db
            .update(assets)
            .set({
              ...assetData,
              assignedToId,
              // Use Intune enrollment date as assignment date, or keep existing if already set
              assignedAt: assignedToId && !existing.assignedToId ? intuneAssignedAt : existing.assignedAt,
              updatedAt: now,
            })
            .where(eq(assets.id, existing.id))
          
          // Handle assignment changes
          if (assignmentChanged) {
            // Close existing assignment if there was one
            if (previousAssignedToId) {
              await db
                .update(assetAssignments)
                .set({ returnedAt: now })
                .where(and(
                  eq(assetAssignments.assetId, existing.id),
                  eq(assetAssignments.personId, previousAssignedToId),
                  isNull(assetAssignments.returnedAt)
                ))
              
              // Log return event
              await db.insert(assetLifecycleEvents).values({
                orgId,
                assetId: existing.id,
                eventType: "returned",
                eventDate: now,
                details: {
                  source: "intune_sync",
                  previousPersonId: previousAssignedToId,
                },
                performedById: session.userId,
              })
            }
            
            // Create new assignment if there's a new assignee
            if (assignedToId) {
              const assignedPerson = peopleByEmail.get(device.userPrincipalName?.toLowerCase() || "")
              
              await db.insert(assetAssignments).values({
                assetId: existing.id,
                personId: assignedToId,
                assignedAt: intuneAssignedAt, // Use Intune enrollment date
                assignedById: session.userId,
                notes: "Assigned via Intune sync",
              })
              
              // Log assignment event
              await db.insert(assetLifecycleEvents).values({
                orgId,
                assetId: existing.id,
                eventType: "assigned",
                eventDate: intuneAssignedAt, // Use Intune enrollment date
                details: {
                  source: "intune_sync",
                  personId: assignedToId,
                  personName: assignedPerson?.name || device.userDisplayName,
                  personEmail: device.userPrincipalName,
                },
                performedById: session.userId,
              })
            }
          }
          
          updatedCount++
        } else if (!syncSettings.syncBehavior?.updateExistingOnly) {
          // Create new asset
          const newAsset = await db
            .insert(assets)
            .values({
              ...assetData,
              assignedToId,
              // Use Intune enrollment date as assignment date
              assignedAt: assignedToId ? intuneAssignedAt : null,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
          
          if (newAsset.length > 0) {
            // Create lifecycle event - use purchase date (Intune enrollment date) if available
            const acquiredDate = assetData.purchaseDate 
              ? new Date(assetData.purchaseDate)
              : now
            
            await db.insert(assetLifecycleEvents).values({
              orgId,
              assetId: newAsset[0].id,
              eventType: "acquired",
              eventDate: acquiredDate,
              details: {
                source: "intune_sync",
                intuneDeviceId: device.id,
                deviceName: device.deviceName,
                enrolledDateTime: device.enrolledDateTime,
              },
              performedById: session.userId,
            })
            
            // Create assignment record if assigned to someone
            if (assignedToId) {
              const assignedPerson = peopleByEmail.get(device.userPrincipalName?.toLowerCase() || "")
              
              await db.insert(assetAssignments).values({
                assetId: newAsset[0].id,
                personId: assignedToId,
                assignedAt: intuneAssignedAt, // Use Intune enrollment date
                assignedById: session.userId,
                notes: "Assigned via Intune sync",
              })
              
              // Log assignment event
              await db.insert(assetLifecycleEvents).values({
                orgId,
                assetId: newAsset[0].id,
                eventType: "assigned",
                eventDate: intuneAssignedAt, // Use Intune enrollment date
                details: {
                  source: "intune_sync",
                  personId: assignedToId,
                  personName: assignedPerson?.name || device.userDisplayName,
                  personEmail: device.userPrincipalName,
                },
                performedById: session.userId,
              })
            }
            
            createdCount++
          }
        } else {
          skippedCount++
        }
      } catch (error) {
        errors.push(`Device ${device.deviceName}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }
    
    // Handle removed devices (if auto-delete is enabled)
    if (syncSettings.syncBehavior?.autoDeleteOnRemoval) {
      const deviceIds = new Set(devices.map(d => d.id))
      const removedAssets = existingAssets.filter(a => a.intuneDeviceId && !deviceIds.has(a.intuneDeviceId))
      
      for (const asset of removedAssets) {
        try {
          await db.delete(assets).where(eq(assets.id, asset.id))
        } catch {
          errors.push(`Failed to delete removed asset ${asset.assetTag}`)
        }
      }
    }
    
    // Update integration sync stats
    await db
      .update(integrations)
      .set({
        lastDeviceSyncAt: now,
        syncedDeviceCount: String(createdCount + updatedCount),
        updatedAt: now,
      })
      .where(eq(integrations.id, integration.id))
    
    // Update assets settings sync stats
    if (settingsResult.length > 0) {
      await db
        .update(assetsSettings)
        .set({
          lastSyncAt: now,
          syncedAssetCount: String(createdCount + updatedCount),
          lastSyncError: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
          lastSyncErrorAt: errors.length > 0 ? now : null,
          updatedAt: now,
        })
        .where(eq(assetsSettings.orgId, orgId))
    }
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("assets.settings", "sync", {
        id: crypto.randomUUID(),
        name: "Intune Device Sync",
        devicesFound: devices.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errors.length,
      })
    }
    
    return NextResponse.json({
      success: errors.length === 0,
      message: errors.length === 0
        ? `Synced ${createdCount + updatedCount} devices from Intune (${assignedCount} assigned to people)`
        : `Sync completed with ${errors.length} errors`,
      syncedCount: createdCount + updatedCount,
      stats: {
        devicesFound: devices.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        assigned: assignedCount,
        unmatchedEmails: unmatchedEmails.slice(0, 20), // First 20 unmatched emails for debugging
        errors: errors.slice(0, 10),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error syncing devices:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    )
  }
}

