/**
 * Documents Page - Main UI for document management
 */

import { FC, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useDocumentsStore } from '../documentsStore'
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { getNostrClient } from '@/core/nostr/client'
import { documentManager } from '../documentManager'
import { TipTapEditor } from './TipTapEditor'
import { documentTemplates } from '../templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FileText, Plus, Save, Download, FileX, Users } from 'lucide-react'
import { getPublicKey } from 'nostr-tools'
import type { DBGroupMember } from '@/core/storage/db'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const DocumentsPage: FC = () => {
  const { groupId } = useParams<{ groupId: string }>()
  const currentIdentity = useAuthStore(state => state.currentIdentity)
  const { groupMembers, loadGroupMembers } = useGroupsStore()

  const { documents, getGroupDocuments, currentDocumentId, setCurrentDocument } = useDocumentsStore()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [collaborationEnabled, setCollaborationEnabled] = useState(true) // Enable by default

  const groupDocs = groupId ? getGroupDocuments(groupId) : []
  const currentDoc = currentDocumentId ? documents.get(currentDocumentId) : null
  const nostrClient = getNostrClient()

  // Load group members for collaboration
  useEffect(() => {
    if (groupId && collaborationEnabled) {
      loadGroupMembers(groupId)
    }
  }, [groupId, collaborationEnabled, loadGroupMembers])

  useEffect(() => {
    if (currentDoc) {
      setTitle(currentDoc.title)
      setContent(currentDoc.content)
    }
  }, [currentDoc])

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!currentDoc || !currentIdentity) return

    const interval = setInterval(async () => {
      const privateKey = getCurrentPrivateKey()
      if (!privateKey) return
      if (content !== currentDoc.content || title !== currentDoc.title) {
        await handleSave()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [currentDoc, content, title, currentIdentity])

  const handleCreate = async () => {
    const privateKey = getCurrentPrivateKey()
    if (!groupId || !privateKey || !title.trim()) return

    setIsCreating(true)
    try {
      const doc = await documentManager.createDocument(
        {
          groupId,
          title: title.trim(),
          content: content,
          template: selectedTemplate || undefined,
        },
        privateKey
      )
      setCurrentDocument(doc.id)
      setIsCreating(false)
    } catch (error) {
      console.error('Failed to create document:', error)
      setIsCreating(false)
    }
  }

  const handleSave = async () => {
    const privateKey = getCurrentPrivateKey()
    if (!currentDoc || !privateKey) return

    setIsSaving(true)
    try {
      await documentManager.updateDocument(
        currentDoc.id,
        { title, content },
        privateKey,
        'Auto-save'
      )
      setIsSaving(false)
    } catch (error) {
      console.error('Failed to save document:', error)
      setIsSaving(false)
    }
  }

  const handleExport = async (format: 'html' | 'markdown' | 'text' | 'pdf') => {
    if (!currentDoc) return

    if (format === 'pdf') {
      // PDF export handles download internally
      await documentManager.exportDocument(currentDoc.id, 'pdf')
    } else {
      const exported = await documentManager.exportDocument(currentDoc.id, format)
      const blob = new Blob([exported], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentDoc.title}.${format === 'markdown' ? 'md' : format}`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-64 border-r p-4 space-y-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="w-full" onClick={() => { setTitle(''); setContent(''); setSelectedTemplate(''); }}>
              <Plus className="mr-2 h-4 w-4" /> New Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Document title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {documentTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} disabled={!title.trim() || isCreating} className="w-full">
                {isCreating ? 'Creating...' : 'Create Document'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-2">
          {groupDocs.map((doc) => (
            <Card
              key={doc.id}
              className={`p-3 cursor-pointer hover:bg-muted ${currentDoc?.id === doc.id ? 'bg-muted' : ''}`}
              onClick={() => setCurrentDocument(doc.id)}
            >
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
          {groupDocs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No documents yet
            </p>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {currentDoc ? (
          <>
            <div className="border-b p-4 flex items-center justify-between">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl font-bold border-none shadow-none focus-visible:ring-0 px-0"
                placeholder="Document title"
              />
              <div className="flex gap-2">
                <Button
                  variant={collaborationEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCollaborationEnabled(!collaborationEnabled)}
                >
                  <Users className="h-4 w-4 mr-1" />
                  {collaborationEnabled ? 'Collaboration On' : 'Enable Collaboration'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving || collaborationEnabled}>
                  <Save className="h-4 w-4 mr-1" /> {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Select onValueChange={(format) => handleExport(format as any)}>
                  <SelectTrigger className="w-32">
                    <Download className="h-4 w-4 mr-1" />
                    <SelectValue placeholder="Export" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <TipTapEditor
                content={content}
                onChange={setContent}
                enableCollaboration={collaborationEnabled && !!currentDoc && !!groupId && !!nostrClient && !!getCurrentPrivateKey()}
                documentId={currentDoc.id}
                groupId={groupId}
                nostrClient={nostrClient}
                userPrivateKey={getCurrentPrivateKey() ?? undefined}
                userPublicKey={getCurrentPrivateKey() ? getPublicKey(getCurrentPrivateKey()!) : undefined}
                userName={currentIdentity?.name || 'Anonymous'}
                collaboratorPubkeys={groupId && groupMembers.get(groupId) ? groupMembers.get(groupId)!.map((m: DBGroupMember) => m.pubkey) : []}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileX className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p>Select a document or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
