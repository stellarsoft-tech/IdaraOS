/**
 * SCIM v2 ResourceTypes Endpoint
 * GET /api/scim/v2/ResourceTypes - Returns supported resource types
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyScimToken } from "@/lib/scim/helpers"

/**
 * GET /api/scim/v2/ResourceTypes - List supported resource types
 */
export async function GET(request: NextRequest) {
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 2,
    Resources: [
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
        id: "User",
        name: "User",
        endpoint: "/Users",
        description: "User Account",
        schema: "urn:ietf:params:scim:schemas:core:2.0:User",
        schemaExtensions: [],
        meta: {
          location: `${baseUrl}/api/scim/v2/ResourceTypes/User`,
          resourceType: "ResourceType",
        },
      },
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
        id: "Group",
        name: "Group",
        endpoint: "/Groups",
        description: "Group",
        schema: "urn:ietf:params:scim:schemas:core:2.0:Group",
        schemaExtensions: [],
        meta: {
          location: `${baseUrl}/api/scim/v2/ResourceTypes/Group`,
          resourceType: "ResourceType",
        },
      },
    ],
  })
}
