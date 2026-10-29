/**
 * Security Endpoint Elevation - approver notifications
 * Posts an Adaptive Card to a Teams "Workflows" webhook (Post to a channel when a webhook request is received).
 * Notifications are best-effort: failures are logged, never thrown.
 */

import { decrypt } from "@/lib/encryption"

export interface NewRequestNotification {
  requesterName: string
  requesterEmail: string
  deviceName: string
  // What was asked for, e.g. "Install Git" or "Admin access for 30 min"
  summary: string
  reason: string | null
  reviewUrl: string
}

export function buildNewRequestCard(n: NewRequestNotification) {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Medium", weight: "Bolder", text: "Admin access request" },
            {
              type: "FactSet",
              facts: [
                { title: "Requester", value: `${n.requesterName} (${n.requesterEmail})` },
                { title: "Device", value: n.deviceName },
                { title: "Request", value: n.summary },
                ...(n.reason ? [{ title: "Reason", value: n.reason }] : []),
              ],
            },
          ],
          actions: [{ type: "Action.OpenUrl", title: "Review request", url: n.reviewUrl }],
        },
      },
    ],
  }
}

export async function notifyNewRequest(
  webhookUrlEncrypted: string | null,
  notification: NewRequestNotification
): Promise<void> {
  if (!webhookUrlEncrypted) return

  try {
    const response = await fetch(decrypt(webhookUrlEncrypted), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildNewRequestCard(notification)),
    })
    if (!response.ok) {
      console.error(`[Elevation] Teams webhook returned ${response.status}`)
    }
  } catch (error) {
    console.error("[Elevation] Failed to send Teams notification:", error)
  }
}
