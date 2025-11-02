'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, Workflow as WorkflowIcon, Play, History, Key, MessageSquare, Webhook, Clock, Send, Sliders } from 'lucide-react';
import { WorkflowListItem } from '@/types/workflows';
import { WorkflowExecutionDialog } from './workflow-execution-dialog';
import { CredentialsConfigDialog } from './credentials-config-dialog';
import { WorkflowSettingsDialog } from './workflow-settings-dialog';

interface WorkflowCardProps {
  workflow: WorkflowListItem;
  onDeleted: () => void;
  onExport: (id: string) => void;
  onRun: (id: string) => void;
  onViewHistory: (id: string) => void;
  onUpdated?: () => void;
}

export function WorkflowCard({ workflow, onDeleted, onExport, onRun, onViewHistory, onUpdated }: WorkflowCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [credentialsConfigOpen, setCredentialsConfigOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${workflow.name}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      onDeleted();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      alert('Failed to delete workflow');
    } finally {
      setDeleting(false);
    }
  };

  const handleRunClick = () => {
    setExecutionDialogOpen(true);
  };

  const handleExecuted = () => {
    onRun(workflow.id); // Trigger refresh
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'draft':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
      case 'paused':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'error':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getRunStatusColor = (status: string | null) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'error':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'running':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getRunButtonConfig = () => {
    switch (workflow.trigger.type) {
      case 'chat':
        return { icon: MessageSquare, label: 'Chat' };
      case 'webhook':
        return { icon: Webhook, label: 'Webhook' };
      case 'cron':
        return { icon: Clock, label: 'Schedule' };
      case 'telegram':
        return { icon: Send, label: 'Telegram' };
      case 'discord':
        return { icon: Send, label: 'Discord' };
      case 'manual':
      default:
        return { icon: Play, label: 'Run' };
    }
  };

  const runButtonConfig = getRunButtonConfig();
  const RunIcon = runButtonConfig.icon;

  return (
    <Card className="group relative overflow-hidden rounded-lg border border-border/50 bg-surface/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 hover:scale-[1.02]">
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <WorkflowIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <CardTitle className="card-title truncate">{workflow.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onExport(workflow.id)}
              title="Export workflow"
              className="transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <Download className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete workflow"
              className="transition-all duration-200 hover:scale-110 active:scale-95 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
            </Button>
          </div>
        </div>
        {workflow.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {workflow.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={getStatusColor(workflow.status)}>
            {workflow.status}
          </Badge>
          {workflow.lastRunStatus && (
            <Badge variant="secondary" className={getRunStatusColor(workflow.lastRunStatus)}>
              {workflow.lastRunStatus}
            </Badge>
          )}
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Created:</span>
            <span>{formatDate(workflow.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Last run:</span>
            <span>{formatDate(workflow.lastRun)}</span>
          </div>
          <div className="flex justify-between">
            <span>Runs:</span>
            <span className="font-medium">{workflow.runCount}</span>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRunClick}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group"
            title={`Execute workflow via ${runButtonConfig.label.toLowerCase()}`}
          >
            <RunIcon className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:scale-110" />
            <span className="text-xs">{runButtonConfig.label}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsDialogOpen(true)}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group"
            title="Configure workflow settings"
          >
            <Sliders className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:rotate-90" />
            <span className="text-xs">Settings</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCredentialsConfigOpen(true)}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group"
            title="Configure credentials"
          >
            <Key className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:-rotate-12" />
            <span className="text-xs">Credentials</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewHistory(workflow.id)}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group"
            title="View execution history"
          >
            <History className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:rotate-180" />
            <span className="text-xs">History</span>
          </Button>
        </div>
      </CardContent>

      <WorkflowExecutionDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        triggerType={workflow.trigger.type}
        triggerConfig={workflow.trigger.config}
        open={executionDialogOpen}
        onOpenChange={setExecutionDialogOpen}
        onExecuted={handleExecuted}
      />

      <CredentialsConfigDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        open={credentialsConfigOpen}
        onOpenChange={setCredentialsConfigOpen}
      />

      <WorkflowSettingsDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        workflowConfig={workflow.config}
        workflowTrigger={workflow.trigger}
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onUpdated={onUpdated}
      />
    </Card>
  );
}
