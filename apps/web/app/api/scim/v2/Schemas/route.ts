/**
 * SCIM v2 Schemas Endpoint
 * GET /api/scim/v2/Schemas - Returns supported schemas
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyScimToken } from "@/lib/scim/helpers"

/**
 * GET /api/scim/v2/Schemas - List supported schemas
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
      // User Schema
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Schema"],
        id: "urn:ietf:params:scim:schemas:core:2.0:User",
        name: "User",
        description: "User Account",
        attributes: [
          {
            name: "userName",
            type: "string",
            multiValued: false,
            description: "Unique identifier for the User",
            required: true,
            caseExact: false,
            mutability: "readWrite",
            returned: "default",
            uniqueness: "server",
          },
          {
            name: "name",
            type: "complex",
            multiValued: false,
            description: "The components of the user's name",
            required: false,
            subAttributes: [
              {
                name: "formatted",
                type: "string",
                multiValued: false,
                description: "The full name",
                required: false,
                mutability: "readWrite",
                returned: "default",
              },
              {
                name: "givenName",
                type: "string",
                multiValued: false,
                description: "The given name",
                required: false,
                mutability: "readWrite",
                returned: "default",
              },
              {
                name: "familyName",
                type: "string",
                multiValued: false,
                description: "The family name",
                required: false,
                mutability: "readWrite",
                returned: "default",
              },
            ],
            mutability: "readWrite",
            returned: "default",
          },
          {
            name: "displayName",
            type: "string",
            multiValued: false,
            description: "The name displayed for the User",
            required: false,
            mutability: "readWrite",
            returned: "default",
          },
          {
            name: "emails",
            type: "complex",
            multiValued: true,
            description: "Email addresses for the user",
            required: false,
            subAttributes: [
              {
                name: "value",
                type: "string",
                multiValued: false,
                description: "Email address",
                required: false,
                mutability: "readWrite",
                returned: "default",
              },
              {
                name: "type",
                type: "string",
                multiValued: false,
                description: "Type of email (work, home)",
                required: false,
                mutability: "readWrite",
                returned: "default",
              },
              {
                name: "primary",
                type: "boolean",
                multiValued: false,
                description: "Is this the primary email",
                required: false,
                mutability: "readWrite",
                returned: "default",
              },
            ],
            mutability: "readWrite",
            returned: "default",
          },
          {
            name: "active",
            type: "boolean",
            multiValued: false,
            description: "User administrative status",
            required: false,
            mutability: "readWrite",
            returned: "default",
          },
          {
            name: "externalId",
            type: "string",
            multiValued: false,
            description: "External identifier from the provisioning client",
            required: false,
            caseExact: true,
            mutability: "readWrite",
            returned: "default",
          },
        ],
        meta: {
          resourceType: "Schema",
          location: `${baseUrl}/api/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User`,
        },
      },
      // Group Schema
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Schema"],
        id: "urn:ietf:params:scim:schemas:core:2.0:Group",
        name: "Group",
        description: "Group",
        attributes: [
          {
            name: "displayName",
            type: "string",
            multiValued: false,
            description: "Human-readable name for the Group",
            required: true,
            caseExact: false,
            mutability: "readWrite",
            returned: "default",
            uniqueness: "server",
          },
          {
            name: "members",
            type: "complex",
            multiValued: true,
            description: "A list of members of the Group",
            required: false,
            subAttributes: [
              {
                name: "value",
                type: "string",
                multiValued: false,
                description: "Identifier of the member of this Group",
                required: false,
                mutability: "immutable",
                returned: "default",
              },
              {
                name: "$ref",
                type: "reference",
                multiValued: false,
                description: "The URI of the member resource",
                required: false,
                mutability: "immutable",
                returned: "default",
              },
              {
                name: "display",
                type: "string",
                multiValued: false,
                description: "A human-readable name for the member",
                required: false,
                mutability: "immutable",
                returned: "default",
              },
            ],
            mutability: "readWrite",
            returned: "default",
          },
          {
            name: "externalId",
            type: "string",
            multiValued: false,
            description: "External identifier from the provisioning client",
            required: false,
            caseExact: true,
            mutability: "readWrite",
            returned: "default",
          },
        ],
        meta: {
          resourceType: "Schema",
          location: `${baseUrl}/api/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group`,
        },
      },
    ],
  })
}
