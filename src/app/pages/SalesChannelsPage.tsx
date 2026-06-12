import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  SalesChannelRecord,
  SyncJobRecord,
  fetchSalesChannelsApi,
  fetchSyncJobsApi,
  syncSalesChannelOrdersApi,
  syncSalesChannelProductsApi,
} from '../services/api';
import { toast } from 'sonner';

export function SalesChannelsPage() {
  const [channels, setChannels] = useState<SalesChannelRecord[]>([]);
  const [jobs, setJobs] = useState<SyncJobRecord[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [channelRows, jobRows] = await Promise.all([fetchSalesChannelsApi(), fetchSyncJobsApi()]);
      setChannels(channelRows);
      setJobs(jobRows);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur integrations');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runSync = async (channel: SalesChannelRecord, type: 'products' | 'orders') => {
    try {
      if (type === 'products') {
        await syncSalesChannelProductsApi(channel.id);
      } else {
        await syncSalesChannelOrdersApi(channel.id);
      }
      toast.success(`Sync ${type} lancee`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync echouee');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>Vendre en ligne</h1>
        <p className="text-muted-foreground">Shopify, WooCommerce, PrestaShop et canal manuel avec architecture de sync mock</p>
      </div>

      {error && <Card className="border-warning bg-warning/5 p-4 text-sm">{error}</Card>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {channels.map((channel) => (
          <Card key={channel.id} className="p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3>{channel.name}</h3>
                <p className="text-sm text-muted-foreground">{channel.provider}</p>
              </div>
              <Badge variant={channel.status === 'connected' ? 'default' : 'outline'}>{channel.status}</Badge>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground">Product sync</p><p>{channel.productSyncEnabled ? 'Enabled' : 'Disabled'}</p></div>
              <div><p className="text-muted-foreground">Order sync</p><p>{channel.orderSyncEnabled ? 'Enabled' : 'Disabled'}</p></div>
              <div className="col-span-2"><p className="text-muted-foreground">Last sync</p><p>{channel.lastSyncAt || 'Never'}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => void runSync(channel, 'products')}>
                <RefreshCw size={14} />
                Product sync
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => void runSync(channel, 'orders')}>
                <RefreshCw size={14} />
                Order sync
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="mb-4">Historique sync</h3>
        <div className="space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune synchronisation lancee.</p>
          ) : jobs.slice(0, 8).map((job) => (
            <div key={job.id} className="flex items-center justify-between border-b pb-3 text-sm last:border-0">
              <div>
                <p className="font-medium">{job.provider} - {job.type}</p>
                <p className="text-muted-foreground">{job.startedAt}</p>
              </div>
              <Badge>{job.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
