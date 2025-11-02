'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkflowCredentialsStatus } from './workflow-credentials-status';
import { Info } from 'lucide-react';

interface CredentialsConfigDialogProps {
  workflowId: string;
  workflowName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CredentialsConfigDialog({
  workflowId,
  workflowName,
  open,
  onOpenChange,
}: CredentialsConfigDialogProps) {
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    const checkCredentials = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/workflows/${workflowId}/credentials`);
        if (response.ok) {
          const data = await response.json();
          setHasCredentials(data.credentials && data.credentials.length > 0);
        }
      } catch (error) {
        console.error('Failed to check credentials:', error);
      } finally {
        setLoading(false);
      }
    };

    checkCredentials();
  }, [workflowId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] scrollbar-none">
        <DialogHeader>
          <DialogTitle className="text-foreground">Credentials & API Keys: {workflowName}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure OAuth connections and API keys required for this workflow.
            Select which accounts or keys to use for each platform.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 scrollbar-none">
          {loading ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Required Credentials:</div>
              <div className="space-y-1.5">
                <Skeleton className="h-10 w-full rounded-md animate-pulse" />
                <Skeleton className="h-10 w-full rounded-md animate-pulse" />
                <Skeleton className="h-10 w-full rounded-md animate-pulse" />
              </div>
            </div>
          ) : hasCredentials === false ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-6 text-center transition-all duration-200 hover:bg-muted/40 hover:border-border">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 dark:bg-blue-500/20 mb-3 transition-transform duration-200 hover:scale-110">
                <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-2">
                No External Credentials Required
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This workflow doesn&apos;t use any external APIs or services that require authentication.
                If you add steps that connect to platforms like Twitter, OpenAI, or other services,
                their credentials will appear here.
              </p>
            </div>
          ) : (
            <WorkflowCredentialsStatus workflowId={workflowId} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
