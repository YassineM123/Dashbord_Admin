import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, Plus } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AdCampaignRecord, fetchAdCampaignsApi, generateAdCopyApi } from '../services/api';
import { toast } from 'sonner';

export function AdsPage() {
  const [campaigns, setCampaigns] = useState<AdCampaignRecord[]>([]);
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setCampaigns(await fetchAdCampaignsApi());
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur campagnes ads');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const totals = useMemo(() => {
    const spend = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);
    const revenue = campaigns.reduce((sum, campaign) => sum + campaign.revenue, 0);
    return {
      spend,
      revenue,
      roas: spend ? Math.round((revenue / spend) * 100) / 100 : 0,
      clicks: campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0),
    };
  }, [campaigns]);

  const generateIdea = async () => {
    const copy = await generateAdCopyApi({ product: 'best sellers', audience: 'repeat buyers' });
    setIdea(`${copy.headline}: ${copy.primaryText} Ideas: ${copy.ideas.join(', ')}`);
    toast.success('Idee de campagne generee');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1>Publicite</h1>
          <p className="text-muted-foreground">Meta Ads, Google Ads, resultats et generateur IA</p>
        </div>
        <Button className="gap-2" onClick={() => void generateIdea()}>
          <Lightbulb size={16} />
          Idee IA
        </Button>
      </div>

      {error && <Card className="border-warning bg-warning/5 p-4 text-sm">{error}</Card>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-muted-foreground">Budget</p><p className="text-2xl font-semibold">{totals.spend} TND</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Revenu</p><p className="text-2xl font-semibold">{totals.revenue} TND</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">ROAS</p><p className="text-2xl font-semibold">{totals.roas}x</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Clics</p><p className="text-2xl font-semibold">{totals.clicks}</p></Card>
      </div>

      {idea && <Card className="p-4 text-sm">{idea}</Card>}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Campagne</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Plateforme</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Objectif</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Budget</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Resultats</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-4 text-sm text-muted-foreground" colSpan={6}>Chargement...</td></tr>
              ) : campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b hover:bg-accent/50">
                  <td className="px-4 py-3 text-sm font-medium">{campaign.name}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{campaign.platform}</Badge></td>
                  <td className="px-4 py-3 text-sm">{campaign.objective}</td>
                  <td className="px-4 py-3 text-right text-sm">{campaign.budget} TND</td>
                  <td className="px-4 py-3 text-right text-sm">{campaign.impressions} imp. / {campaign.clicks} clics / {campaign.orders} orders</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{campaign.roas}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Button variant="outline" className="gap-2" onClick={() => toast.info('Creation campagne: backend endpoint pret, formulaire detaille a brancher')}>
        <Plus size={16} />
        Nouvelle campagne
      </Button>
    </div>
  );
}
