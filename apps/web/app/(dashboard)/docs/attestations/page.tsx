"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle, Clock, Eye, FileText, Search, Users } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDocuments, useAcknowledgments } from "@/lib/api/docs"
import type { DocumentWithRelations } from "@/lib/docs/types"

export default function AttestationsPage() {
  const [selectedDocId, setSelectedDocId] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  
  const { data: docsData } = useDocuments({ status: "published" })
  const { data: acksData, isLoading } = useAcknowledgments(
    selectedDocId !== "all" ? { documentId: selectedDocId } : undefined
  )
  
  const documents = docsData?.data || []
  const acknowledgments = acksData?.data || []
  
  // Filter acknowledgments by status
  const filteredAcks = acknowledgments.filter((ack) => {
    if (statusFilter === "all") return true
    if (statusFilter === "completed") return ["acknowledged", "signed"].includes(ack.status)
    if (statusFilter === "pending") return ["pending", "viewed"].includes(ack.status)
    return ack.status === statusFilter
  })
  
  // Calculate stats
  const stats = {
    total: acknowledgments.length,
    pending: acknowledgments.filter((a) => a.status === "pending").length,
    viewed: acknowledgments.filter((a) => a.status === "viewed").length,
    completed: acknowledgments.filter((a) => ["acknowledged", "signed"].includes(a.status)).length,
  }
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="Attestations"
        description="Track document acknowledgements and policy sign-offs across the organization."
      />
      
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Attestations"
          value={isLoading ? "-" : stats.total}
          icon={Users}
        />
        <StatCard
          title="Pending"
          value={isLoading ? "-" : stats.pending}
          icon={Clock}
        />
        <StatCard
          title="Viewed"
          value={isLoading ? "-" : stats.viewed}
          icon={Eye}
        />
        <StatCard
          title="Completed"
          value={isLoading ? "-" : stats.completed}
          icon={CheckCircle}
        />
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={selectedDocId} onValueChange={setSelectedDocId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="All Documents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Documents</SelectItem>
            {documents.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="viewed">Viewed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Attestations List */}
      <Card>
        <CardHeader>
          <CardTitle>Attestation Records</CardTitle>
          <CardDescription>
            Individual acknowledgement records for documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAcks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No attestations found</p>
              {selectedDocId === "all" && (
                <p className="text-sm text-muted-foreground mt-1">
                  Select a document to view its attestation records
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAcks.map((ack) => (
                <div
                  key={ack.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{ack.userName}</p>
                    <p className="text-xs text-muted-foreground">{ack.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge
                      variant={
                        ack.status === "signed" || ack.status === "acknowledged"
                          ? "success"
                          : ack.status === "viewed"
                          ? "warning"
                          : "default"
                      }
                    >
                      {ack.status}
                    </StatusBadge>
                    {ack.acknowledgedAt ? (
                      <span className="text-xs text-muted-foreground">
                        {new Date(ack.acknowledgedAt).toLocaleDateString()}
                      </span>
                    ) : ack.viewedAt ? (
                      <span className="text-xs text-muted-foreground">
                        Viewed {new Date(ack.viewedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not started</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Documents with Rollouts */}
      <Card>
        <CardHeader>
          <CardTitle>Documents with Active Rollouts</CardTitle>
          <CardDescription>
            Documents that have been rolled out for attestation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground">No published documents with rollouts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <DocumentAttestationRow key={doc.id} document={doc} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentAttestationRow({ document: doc }: { document: DocumentWithRelations }) {
  const stats = doc.acknowledgmentStats || { total: 0, pending: 0, acknowledged: 0, signed: 0 }
  const completed = stats.acknowledged + stats.signed
  const completionRate = stats.total > 0 ? Math.round((completed / stats.total) * 100) : 0
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">{doc.title}</p>
          <p className="text-xs text-muted-foreground">
            v{doc.currentVersion} • {doc.category}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {stats.total > 0 ? (
          <>
            <div className="text-right">
              <p className="text-sm font-medium">{completed}/{stats.total}</p>
              <p className="text-xs text-muted-foreground">completed</p>
            </div>
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground w-12">{completionRate}%</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">No rollouts</span>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href={`/docs/documents/${doc.slug}`}>View</Link>
        </Button>
      </div>
    </div>
  )
}
