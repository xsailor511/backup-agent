"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { BackupProgress } from "@/types"

interface ProgressModalProps {
  open: boolean
  progress: BackupProgress | null
  onCancel?: () => void
}

export function ProgressModal({ open, progress, onCancel }: ProgressModalProps) {
  if (!progress) return null
  
  const percentage = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0
  
  const phaseLabels: Record<string, string> = {
    scanning: "Scanning files...",
    compressing: "Compressing files...",
    extracting: "Extracting files...",
    restoring: "Restoring files...",
  }
  
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {phaseLabels[progress.phase] || "Processing..."}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Progress value={percentage} />
          
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{percentage}%</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm font-medium truncate">{progress.current_file}</p>
          </div>
        </div>
        
        <DialogFooter>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}