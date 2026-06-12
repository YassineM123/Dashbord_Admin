import { useEffect, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MarketingCampaignRecord, MarketingTemplateRecord, fetchMarketingCampaignsApi, fetchMarketingTemplatesApi, generateMarketingCopyApi } from '../services/api';
import { toast } from 'sonner';

export function EmailSmsMarketingPage() {
  const [campaigns, setCampaigns] = useState<MarketingCampaignRecord[]>([]);
  const [templates, setTemplates] = useState<MarketingTemplateRecord[]>([]);
  const [copy, setCopy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [campaignRows, templateRows] = await Promise.all([fetchMarketingCampaignsApi(), fetchMarketingTemplatesApi()]);
        setCampaigns(campaignRows);
        setTemplates(templateRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur marketing');
      }
    };
    void load();
  }, []);

  const generateCopy = async () => {
    const result = await generateMarketingCopyApi({ product: 'new collection', audience: 'VIP customers' });
    setCopy(`${result.subject}\n${result.body}`);
    toast.success('Copy email genere');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1>Email / SMS marketing</h1>
          <p className="text-muted-foreground">Campagnes, segments, templates, paniers abandonnes et copy IA</p>
        </div>
        <Button className="gap-2" onClick={() => void generateCopy()}>
          <Wand2 size={16} />
          Generer copy IA
        </Button>
      </div>

      {error && <Card className="border-warning bg-warning/5 p-4 text-sm">{error}</Card>}
      {copy && <Card className="whitespace-pre-wrap p-4 text-sm">{copy}</Card>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-muted-foreground">Campagnes</p><p className="text-2xl font-semibold">{campaigns.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Templates</p><p className="text-2xl font-semibold">{templates.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Paniers abandonnes</p><p className="text-2xl font-semibold">Placeholder</p></Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Campagne</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Canal</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Segment</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Planification</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b hover:bg-accent/50">
                  <td className="px-4 py-3 text-sm font-medium">{campaign.name}<p className="text-xs text-muted-foreground">{campaign.subject}</p></td>
                  <td className="px-4 py-3 text-sm">{campaign.channel}</td>
                  <td className="px-4 py-3 text-sm">{campaign.segment}</td>
                  <td className="px-4 py-3"><Badge>{campaign.status}</Badge></td>
                  <td className="px-4 py-3 text-sm">{campaign.scheduledAt || campaign.sentAt || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4">Templates</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {templates.map((template) => (
            <div key={template.id} className="rounded-lg border p-4">
              <p className="font-medium">{template.name}</p>
              <p className="text-sm text-muted-foreground">{template.subject || template.channel}</p>
              {template.placeholder && <Badge variant="outline" className="mt-2">Placeholder</Badge>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
