/**
 * SCIM v2 ServiceProviderConfig Endpoint
 * GET /api/scim/v2/ServiceProviderConfig - Returns service provider configuration
 */

import { NextRequest, NextResponse } from "next/server"
import { getEntraConfig } from "@/lib/auth/entra-config"
import { decrypt } from "@/lib/encryption"

/**
 * Verify SCIM authentication token
 */
async function verifyScimToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false
  }

  const token = authHeader.substring(7)
  const config = await getEntraConfig()
  
  if (!config || !config.scimEnabled || !config.scimTokenEncrypted) {
    return false
  }

  try {
    const decryptedToken = decrypt(config.scimTokenEncrypted)
    return decryptedToken === token
  } catch {
    return false
  }
}

/**
 * GET /api/scim/v2/ServiceProviderConfig - Service Provider Configuration
 */
export async function GET(request: NextRequest) {
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: "https://tools.ietf.org/html/rfc7644",
    patch: {
      supported: true,
    },
    bulk: {
      supported: false,
      maxOperations: 0,
      maxPayloadSize: 0,
    },
    filter: {
      supported: true,
      maxResults: 200,
    },
    changePassword: {
      supported: false,
    },
    sort: {
      supported: false,
    },
    etag: {
      supported: false,
    },
    authenticationSchemes: [
      {
        type: "oauthbearertoken",
        name: "OAuth Bearer Token",
        description: "Authentication using OAuth Bearer Token",
        specUri: "http://www.rfc-editor.org/info/rfc6750",
        documentationUri: "http://www.rfc-editor.org/info/rfc6750",
        primary: true,
      },
    ],
    meta: {
      location: `${baseUrl}/api/scim/v2/ServiceProviderConfig`,
      resourceType: "ServiceProviderConfig",
    },
  })
}
