'use client';

import { WorkflowCard } from './workflow-card';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkflowListItem } from '@/types/workflows';

interface WorkflowsListProps {
  workflows: WorkflowListItem[];
  loading: boolean;
  onWorkflowDeleted: () => void;
  onWorkflowExport: (id: string) => void;
  onWorkflowRun: (id: string) => void;
  onWorkflowViewHistory: (id: string) => void;
  onWorkflowUpdated?: () => void;
}

export function WorkflowsList({
  workflows,
  loading,
  onWorkflowDeleted,
  onWorkflowExport,
  onWorkflowRun,
  onWorkflowViewHistory,
  onWorkflowUpdated,
}: WorkflowsListProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/30">
        <div className="max-w-md mx-auto space-y-4">
          <h3 className="text-lg font-semibold">No workflows yet</h3>
          <p className="text-sm text-muted-foreground">
            Get started by creating your first workflow using AI
          </p>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground text-left">
            <p>• Chat with AI to generate workflows</p>
            <p>• Import existing workflow JSON files</p>
            <p>• Browse templates (coming soon)</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {workflows.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          onDeleted={onWorkflowDeleted}
          onExport={onWorkflowExport}
          onRun={onWorkflowRun}
          onViewHistory={onWorkflowViewHistory}
          onUpdated={onWorkflowUpdated}
        />
      ))}
    </div>
  );
}
