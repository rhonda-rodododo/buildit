import { FC, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { VotingMethod } from '../types'
import { proposalManager } from '../proposalManager'
import { useAuthStore } from '@/stores/authStore'

interface CreateProposalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  onCreated?: () => void
}

export const CreateProposalDialog: FC<CreateProposalDialogProps> = ({
  open,
  onOpenChange,
  groupId,
  onCreated,
}) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [votingMethod, setVotingMethod] = useState<VotingMethod>('simple')
  const [options, setOptions] = useState('')
  const [duration, setDuration] = useState('7')
  const [quorum, setQuorum] = useState('50')
  const [threshold, setThreshold] = useState('50')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentIdentity = useAuthStore(state => state.currentIdentity)

  const handleCreate = async () => {
    if (!currentIdentity?.privateKey) {
      setError('No active identity. Please log in.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      await proposalManager.createProposal(
        {
          groupId,
          title,
          description,
          votingMethod,
          options: (votingMethod === 'ranked-choice' || votingMethod === 'quadratic')
            ? options.split('\n').filter(o => o.trim())
            : undefined,
          votingDuration: parseInt(duration) * 24 * 60 * 60, // days to seconds
          quorum: parseInt(quorum),
          threshold: parseInt(threshold),
        },
        currentIdentity.privateKey
      )

      // Reset form
      setTitle('')
      setDescription('')
      setVotingMethod('simple')
      setOptions('')
      setDuration('7')
      setQuorum('50')
      setThreshold('50')

      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create proposal'
      setError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Proposal</DialogTitle>
          <DialogDescription>
            Create a new proposal for democratic decision-making
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Proposal title..."
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the proposal..."
              rows={4}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="voting-method">Voting Method</Label>
            <Select value={votingMethod} onValueChange={(v) => setVotingMethod(v as VotingMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple Majority (Yes/No/Abstain)</SelectItem>
                <SelectItem value="ranked-choice">Ranked Choice Voting</SelectItem>
                <SelectItem value="quadratic">Quadratic Voting</SelectItem>
                <SelectItem value="consensus">Consensus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(votingMethod === 'ranked-choice' || votingMethod === 'quadratic') && (
            <div className="grid gap-2">
              <Label htmlFor="options">Options (one per line)</Label>
              <Textarea
                id="options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                rows={4}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quorum">Quorum (%)</Label>
              <Input
                id="quorum"
                type="number"
                min="0"
                max="100"
                value={quorum}
                onChange={(e) => setQuorum(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="threshold">Threshold (%)</Label>
              <Input
                id="threshold"
                type="number"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="duration">Voting Duration (days)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title || !description || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Proposal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
