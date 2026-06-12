import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plug, ShieldCheck, TestTube2, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  IntegrationRecord,
  IntegrationsHealth,
  connectIntegrationApi,
  disconnectIntegrationApi,
  fetchIntegrationSettingsApi,
  fetchIntegrationsHealthApi,
  testIntegrationConnectionApi,
} from '../services/api';

function formatDate(value?: string) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-TN');
}

function statusClass(status: string) {
  if (status === 'connected') return 'bg-success/10 text-success';
  if (status === 'error') return 'bg-destructive/10 text-destructive';
  return 'bg-muted text-muted-foreground';
}

export function IntegrationsSettingsPage() {
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [health, setHealth] = useState<IntegrationsHealth | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const grouped = useMemo(() => {
    return integrations.reduce<Record<string, IntegrationRecord[]>>((acc, integration) => {
      acc[integration.category] = [...(acc[integration.category] || []), integration];
      return acc;
    }, {});
  }, [integrations]);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, healthData] = await Promise.all([fetchIntegrationSettingsApi(), fetchIntegrationsHealthApi()]);
      setIntegrations(rows);
      setHealth(healthData);
      setDrafts((prev) => {
        const next = { ...prev };
        rows.forEach((integration) => {
          next[integration.id] = {
            ...(integration.config || {}),
            ...(next[integration.id] || {}),
          };
        });
        return next;
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateDraft = (integrationId: string, key: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [integrationId]: {
        ...(prev[integrationId] || {}),
        [key]: value,
      },
    }));
  };

  const connect = async (integration: IntegrationRecord) => {
    setSavingId(integration.id);
    try {
      const updated = await connectIntegrationApi(integration.id, { config: drafts[integration.id] || {} });
      setIntegrations((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast.success(`${integration.name} connected`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setSavingId('');
    }
  };

  const disconnect = async (integration: IntegrationRecord) => {
    setSavingId(integration.id);
    try {
      const updated = await disconnectIntegrationApi(integration.id);
      setIntegrations((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast.success(`${integration.name} disconnected`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setSavingId('');
    }
  };

  const test = async (integration: IntegrationRecord) => {
    setSavingId(integration.id);
    try {
      const result = await testIntegrationConnectionApi(integration.id);
      setIntegrations((prev) => prev.map((row) => (row.id === result.id ? result : row)));
      toast[result.healthy ? 'success' : 'error'](result.healthy ? 'Connection test passed' : 'Connection test failed');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1>Integrations Settings</h1>
          <p className="text-muted-foreground">Connect providers without exposing API keys or secrets in the frontend</p>
        </div>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className={health?.ok ? 'text-success' : 'text-warning'} size={20} />
            <div>
              <p className="text-sm font-medium">{health?.connected || 0}/{health?.total || 0} configured</p>
              <p className="text-xs text-muted-foreground">Last health check: {formatDate(health?.checkedAt)}</p>
            </div>
          </div>
        </Card>
      </div>

      {error && <Card className="border-destructive bg-destructive/5 p-4 text-sm text-destructive">{error}</Card>}

      <Card className="border-info/30 bg-info/5 p-4 text-sm">
        Secrets are never returned by the API. Entered keys are converted to backend metadata with masked values only. Production deployments should provide real secrets through backend environment variables or encrypted secret storage.
      </Card>

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading integrations...</Card>
      ) : (
        Object.entries(grouped).map(([category, rows]) => (
          <section key={category} className="space-y-3">
            <h2 className="text-lg font-semibold">{category}</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {rows.map((integration) => (
                <Card key={integration.id} className="p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{integration.name}</h3>
                        {integration.envConfigured && <Badge variant="outline">env</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{integration.message || 'Not configured'}</p>
                    </div>
                    <Badge className={statusClass(integration.status)}>{integration.status}</Badge>
                  </div>

                  <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">Last sync</p>
                      <p>{formatDate(integration.lastSync)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last test</p>
                      <p>{formatDate(integration.lastTestAt)}</p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {integration.fields.map((field) => (
                      <div key={field.key}>
                        <Label htmlFor={`${integration.id}-${field.key}`}>{field.label}</Label>
                        {field.secret && integration.secrets[field.key]?.hasValue && (
                          <p className="mb-1 text-xs text-muted-foreground">
                            Saved: {integration.secrets[field.key].maskedValue} ({integration.secrets[field.key].source || 'backend'})
                          </p>
                        )}
                        <Input
                          id={`${integration.id}-${field.key}`}
                          type={field.secret ? 'password' : field.type || 'text'}
                          value={drafts[integration.id]?.[field.key] || ''}
                          placeholder={field.secret ? 'Enter new secret to replace masked value' : field.label}
                          onChange={(event) => updateDraft(integration.id, field.key, event.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" className="gap-2" onClick={() => void connect(integration)} disabled={savingId === integration.id}>
                      <Plug size={14} />
                      Connect
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => void test(integration)} disabled={savingId === integration.id}>
                      <TestTube2 size={14} />
                      Test
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => void disconnect(integration)} disabled={savingId === integration.id}>
                      <Unplug size={14} />
                      Disconnect
                    </Button>
                    {integration.connected && (
                      <span className="inline-flex items-center gap-1 text-sm text-success">
                        <CheckCircle2 size={14} />
                        Connected
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
