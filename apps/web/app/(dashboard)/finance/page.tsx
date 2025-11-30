import Link from "next/link"
import { ArrowRight, Building, CreditCard, DollarSign, FileText, Plus, TrendingUp } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function FinanceOverviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Finance" description="Manage expenses, invoices, and financial operations.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Expense
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Monthly Expenses" value="$24,500" icon={CreditCard} />
        <StatCard title="Pending Invoices" value={5} icon={FileText} />
        <StatCard title="Revenue (MTD)" value="$156,000" icon={TrendingUp} />
        <StatCard title="Vendors" value={12} icon={Building} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/finance/expenses">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Expenses
              </CardTitle>
              <CardDescription>Track and manage expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="warning">3 pending approval</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/finance/invoices">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoices
              </CardTitle>
              <CardDescription>Manage billing and payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">5 outstanding</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/finance/accounts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Chart of Accounts
              </CardTitle>
              <CardDescription>Financial account structure</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">24 accounts</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest financial activity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { id: 1, description: "AWS Cloud Services", amount: -4500, date: "Nov 28", category: "Infrastructure" },
            { id: 2, description: "Slack Subscription", amount: -850, date: "Nov 25", category: "Software" },
            { id: 3, description: "Client Invoice #1042", amount: 12000, date: "Nov 24", category: "Revenue" },
            { id: 4, description: "Office Supplies", amount: -320, date: "Nov 22", category: "Operations" },
          ].map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">
                  {tx.category} • {tx.date}
                </p>
              </div>
              <span className={`font-medium ${tx.amount > 0 ? "text-green-600" : ""}`}>
                {tx.amount > 0 ? "+" : ""}
                {tx.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
