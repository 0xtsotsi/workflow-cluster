'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Upload, Search, Workflow, CheckCircle2, XCircle } from 'lucide-react';
import { WorkflowsList } from '@/components/workflows/workflows-list';
import { ExecutionResultDialog } from '@/components/workflows/execution-result-dialog';
import { ExecutionHistoryDialog } from '@/components/workflows/execution-history-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { WorkflowListItem } from '@/types/workflows';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [triggerFilter, setTriggerFilter] = useState('all');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    output?: unknown;
    error?: string;
    errorStep?: string;
    duration?: number;
  } | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [executedWorkflowName, setExecutedWorkflowName] = useState('');
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyWorkflowId, setHistoryWorkflowId] = useState('');
  const [historyWorkflowName, setHistoryWorkflowName] = useState('');

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/workflows');
      const data = await response.json();
      setWorkflows(data.workflows || []);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleWorkflowDeleted = () => {
    fetchWorkflows();
  };

  const handleWorkflowRun = async (id: string) => {
    const workflow = workflows.find((w) => w.id === id);
    if (!workflow) return;

    const startTime = Date.now();

    try {
      const response = await fetch(`/api/workflows/${id}/run`, {
        method: 'POST',
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to run workflow');
      }

      const result = await response.json();

      // Show result in dialog
      setExecutionResult({
        ...result,
        duration,
      });
      setExecutedWorkflowName(workflow.name);
      setShowResultDialog(true);

      // Refresh to update last run status
      fetchWorkflows();
    } catch (error) {
      console.error('Failed to run workflow:', error);

      // Show error in dialog
      setExecutionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      setExecutedWorkflowName(workflow.name);
      setShowResultDialog(true);
    }
  };

  const handleWorkflowExport = async (id: string) => {
    try {
      const response = await fetch(`/api/workflows/${id}/export`);
      if (!response.ok) {
        throw new Error('Failed to export workflow');
      }

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-${data.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export workflow:', error);
      alert('Failed to export workflow');
    }
  };

  const handleImportClick = () => {
    setShowImportDialog(true);
    setImportError('');
  };

  const handleViewHistory = (id: string) => {
    const workflow = workflows.find((w) => w.id === id);
    if (!workflow) return;

    setHistoryWorkflowId(id);
    setHistoryWorkflowName(workflow.name);
    setShowHistoryDialog(true);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError('');

    try {
      const text = await file.text();
      const workflowJson = JSON.parse(text);

      const response = await fetch('/api/workflows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowJson }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import workflow');
      }

      const result = await response.json();

      // Show success message with required credentials if any
      if (result.requiredCredentials && result.requiredCredentials.length > 0) {
        alert(
          `Workflow "${result.name}" imported successfully!\n\n` +
          `Required credentials: ${result.requiredCredentials.join(', ')}\n` +
          `Please add these credentials in the Credentials page.`
        );
      } else {
        alert(`Workflow "${result.name}" imported successfully!`);
      }

      setShowImportDialog(false);
      fetchWorkflows();
    } catch (error) {
      console.error('Failed to import workflow:', error);
      setImportError(
        error instanceof Error ? error.message : 'Failed to import workflow'
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Filter and search workflows
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((workflow) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        workflow.description?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter;

      // Trigger filter
      const matchesTrigger = triggerFilter === 'all' || workflow.trigger.type === triggerFilter;

      return matchesSearch && matchesStatus && matchesTrigger;
    });
  }, [workflows, searchQuery, statusFilter, triggerFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = workflows.length;
    const active = workflows.filter((w) => w.status === 'active').length;
    const successful = workflows.filter((w) => w.lastRunStatus === 'success').length;
    const failed = workflows.filter((w) => w.lastRunStatus === 'error').length;

    return { total, active, successful, failed };
  }, [workflows]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        {!loading && workflows.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
                <Workflow className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.active} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.active}</div>
                <p className="text-xs text-muted-foreground">
                  Running workflows
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Run Success</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.successful}</div>
                <p className="text-xs text-muted-foreground">
                  Successful executions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Run Failed</CardTitle>
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.failed}</div>
                <p className="text-xs text-muted-foreground">
                  Needs attention
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-4 w-full sm:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>

            <Select value={triggerFilter} onValueChange={setTriggerFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All triggers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All triggers</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="cron">Scheduled</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleImportClick}
            className="bg-foreground text-background hover:bg-foreground/90 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 group"
          >
            <Upload className="h-4 w-4 mr-2 transition-transform duration-200 group-hover:-translate-y-0.5" />
            Import
          </Button>
        </div>

        <WorkflowsList
          workflows={filteredWorkflows}
          loading={loading}
          onWorkflowDeleted={handleWorkflowDeleted}
          onWorkflowExport={handleWorkflowExport}
          onWorkflowRun={handleWorkflowRun}
          onWorkflowViewHistory={handleViewHistory}
          onWorkflowUpdated={fetchWorkflows}
        />

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Import Workflow</DialogTitle>
              <DialogDescription>
                Upload a workflow JSON file to import it into your account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workflow-file">Workflow File</Label>
                <Input
                  id="workflow-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  disabled={importing}
                  className="transition-all duration-200 file:transition-all file:duration-200 file:hover:bg-accent"
                />
                <p className="text-xs text-muted-foreground">
                  Select a workflow JSON file to import
                </p>
              </div>

              {importError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive animate-in fade-in slide-in-from-top-2 duration-300">
                  {importError}
                </div>
              )}

              {importing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Importing workflow...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <ExecutionResultDialog
          open={showResultDialog}
          onOpenChange={setShowResultDialog}
          result={executionResult}
          workflowName={executedWorkflowName}
        />

        <ExecutionHistoryDialog
          open={showHistoryDialog}
          onOpenChange={setShowHistoryDialog}
          workflowId={historyWorkflowId}
          workflowName={historyWorkflowName}
        />
      </div>
    </DashboardLayout>
  );
}
