import { Download, FileCheck, FileText, Filter, Upload } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { controls } from "@/lib/seed-data"

const evidenceItems = controls
  .flatMap((control) =>
    Array.from({ length: control.evidenceCount }).map((_, i) => ({
      id: `${control.id}-EV-${String(i + 1).padStart(3, "0")}`,
      controlId: control.id,
      controlTitle: control.title,
      type: ["screenshot", "document", "log", "report"][i % 4],
      uploadedBy: control.owner,
      uploadedAt: `2024-${String(10 + (i % 3)).padStart(2, "0")}-${String(10 + i).padStart(2, "0")}`,
    })),
  )
  .slice(0, 20)

export default function EvidencePage() {
  const totalEvidence = controls.reduce((acc, c) => acc + c.evidenceCount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence Store"
        description="Centralized repository for audit evidence and compliance documentation."
      >
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Evidence
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvidence}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Screenshots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Logs & Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">13</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Evidence</CardTitle>
          <CardDescription>Latest evidence uploads across all controls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {evidenceItems.slice(0, 10).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    {item.type === "document" ? (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <FileCheck className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium font-mono text-sm">{item.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.controlId} • {item.controlTitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge variant="default">{item.type}</StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.uploadedAt).toLocaleDateString()}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
