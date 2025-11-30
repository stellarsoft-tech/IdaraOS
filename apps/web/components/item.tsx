export const itemVariants = {
  default: 'bg-transparent',
  outline: 'border',
  muted: 'bg-muted/50',
} as const

export type ItemVariant = keyof typeof itemVariants
