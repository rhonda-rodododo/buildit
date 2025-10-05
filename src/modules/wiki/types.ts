import { z } from 'zod'

export const WikiPageSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  title: z.string().min(1).max(200),
  content: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()),
  version: z.number().int().min(1),
  created: z.number(),
  updated: z.number(),
  updatedBy: z.string(), // pubkey
  parentVersion: z.string().optional(), // For version history
})

export type WikiPage = z.infer<typeof WikiPageSchema>

export interface WikiPageVersion {
  id: string
  pageId: string
  version: number
  content: string
  updatedBy: string
  updated: number
  changeDescription?: string
}

export interface WikiCategory {
  id: string
  groupId: string
  name: string
  description?: string
  pageCount: number
}

export interface CreatePageInput {
  groupId: string
  title: string
  content: string
  category?: string
  tags?: string[]
}

export interface UpdatePageInput {
  pageId: string
  title?: string
  content?: string
  category?: string
  tags?: string[]
  changeDescription?: string
}
