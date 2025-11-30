"use client"

import * as React from "react"
import { Bot, Send, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChatsyDrawerProps {
  open: boolean
  onClose: () => void
}

const suggestedQuestions = [
  "Show me pending approvals",
  "Who's on leave today?",
  "What controls need review?",
  "Find overdue policies",
]

export function ChatsyDrawer({ open, onClose }: ChatsyDrawerProps) {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi! I'm Chatsy, your IdaraOS assistant. I can help you find information, create records, and navigate the system. What can I help you with today?",
    },
  ])
  const [input, setInput] = React.useState("")
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const handleSend = () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getSimulatedResponse(input),
      }
      setMessages((prev) => [...prev, assistantMessage])
    }, 1000)
  }

  const handleSuggestion = (question: string) => {
    setInput(question)
  }

  if (!open) return null

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Chatsy</h3>
            <p className="text-xs text-muted-foreground">AI Assistant</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex gap-2", message.role === "user" && "flex-row-reverse")}>
              {message.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "rounded-lg p-3 text-sm max-w-[85%]",
                  message.role === "assistant" ? "bg-muted" : "bg-primary text-primary-foreground",
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {messages.length === 1 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs text-muted-foreground">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSuggestion(question)}
                    className="text-xs bg-muted hover:bg-muted/80 rounded-full px-3 py-1.5 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Ask me anything..."
            className="h-9"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

function getSimulatedResponse(input: string): string {
  const lower = input.toLowerCase()

  if (lower.includes("pending") || lower.includes("approval")) {
    return "You have 3 pending approvals:\n\n1. Time-off request from Sarah Chen (2 days)\n2. New laptop request for James Wilson\n3. Policy update for Data Retention\n\nWould you like me to navigate you to the approvals page?"
  }

  if (lower.includes("leave") || lower.includes("off today")) {
    return "Today's leave summary:\n\n- Michael Roberts (Vacation)\n- Emily Watson (Sick leave)\n- David Kim (Personal day)\n\n3 team members are out. Would you like to see the full calendar?"
  }

  if (lower.includes("control") || lower.includes("review")) {
    return "5 controls need attention:\n\n- AC-01: Access Control Review (Due in 3 days)\n- CM-02: Change Management (Overdue)\n- IR-03: Incident Response (Due next week)\n\nShould I open the controls library?"
  }

  if (lower.includes("policy") || lower.includes("overdue")) {
    return "2 policies require updates:\n\n- Information Security Policy (Review due: Jan 15)\n- Acceptable Use Policy (Review due: Jan 20)\n\nWould you like me to show you the policy library?"
  }

  return (
    "I understand you're asking about \"" +
    input +
    '". Let me help you with that.\n\nYou can navigate to the relevant section using the sidebar, or I can search across all modules for related information. What would you prefer?'
  )
}
