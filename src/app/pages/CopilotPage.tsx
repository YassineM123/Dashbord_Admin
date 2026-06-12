import { useState } from 'react';
import { Bot, Loader2, AlertCircle, CheckCircle2, Link as LinkIcon } from 'lucide-react';
import { useRole, Role } from '../contexts/RoleContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DatePresetFilter, DatePreset } from '../components/admin/DatePresetFilter';
import { StatusBadge } from '../components/admin/StatusBadge';
import { CopilotAnalysis, analyzeCopilotApi } from '../services/api';
import { CopilotAvancePage } from './CopilotAvancePage';
import { toast } from 'sonner';

interface CopilotPageProps {
  initialMode?: 'standard' | 'advanced';
}

export function CopilotPage({ initialMode = 'standard' }: CopilotPageProps) {
  const { role } = useRole();
  const [mode, setMode] = useState<'standard' | 'advanced'>(initialMode);
  const [selectedRole, setSelectedRole] = useState<Role>(role);
  const [datePreset, setDatePreset] = useState<DatePreset>('30j');
  const [question, setQuestion] = useState('');
  const [showPromptPolicy, setShowPromptPolicy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CopilotAnalysis | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await analyzeCopilotApi({
        role: selectedRole,
        datePreset,
        question,
      });
      setAnalysis(result);
    } catch (e) {
      setAnalysis(null);
      setError(e instanceof Error ? e.message : 'Erreur analyse IA');
    } finally {
      setLoading(false);
    }
  };

  const systemPrompt = `Assistant d'analyse business pour role=${selectedRole} periode=${datePreset}.`;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot size={24} className="text-primary" />
        </div>
        <div className="flex-1">
          <h1>Copilot IA Unifie</h1>
          <p className="text-muted-foreground">Mode standard pour aller vite, mode avance pour une analyse complete</p>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(value) => setMode(value as 'standard' | 'advanced')}>
        <TabsList className="grid w-full grid-cols-2 md:w-[420px]">
          <TabsTrigger value="standard">Standard</TabsTrigger>
          <TabsTrigger value="advanced">Avance</TabsTrigger>
        </TabsList>

        <TabsContent value="standard" className="space-y-6 mt-4">
          {error && (
            <Card className="p-4 border-warning bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-warning mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h3 className="mb-4">Configuration de l'analyse</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as Role)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Executive">Executive</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Periode d'analyse</Label>
                  <DatePresetFilter value={datePreset} onChange={(preset) => setDatePreset(preset)} className="w-full" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="question">Question optionnelle</Label>
                <Textarea
                  id="question"
                  placeholder="Exemple: Pourquoi les ventes ont baisse ?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch id="show-prompt" checked={showPromptPolicy} onCheckedChange={setShowPromptPolicy} />
                <Label htmlFor="show-prompt" className="cursor-pointer">Afficher la politique de prompt systeme</Label>
              </div>

              {showPromptPolicy && (
                <Card className="p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground font-mono">{systemPrompt}</p>
                </Card>
              )}

              <Button onClick={() => void handleAnalyze()} disabled={loading} className="w-full gap-2">
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Bot size={16} />
                    Lancer l'analyse
                  </>
                )}
              </Button>
            </div>
          </Card>

          {loading && (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-primary mb-4" size={48} />
                <p className="text-lg font-medium mb-2">Analyse en cours...</p>
                <p className="text-sm text-muted-foreground">Traitement des donnees et generation des insights</p>
              </div>
            </Card>
          )}

          {analysis && !loading && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="mb-4">Reponse directe</h3>
                <p className="text-muted-foreground leading-relaxed">{analysis.answer}</p>
              </Card>

              <Card className="p-6">
                <h3 className="mb-4">Points cles decouverts</h3>
                <div className="space-y-3">
                  {analysis.findings.map((finding, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                      <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                      <p className="text-sm">{finding}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {analysis.anomalies.length > 0 && (
                <Card className="p-6">
                  <h3 className="mb-4">Anomalies detectees</h3>
                  <div className="space-y-3">
                    {analysis.anomalies.map((anomaly, index) => (
                      <div key={index} className="flex items-start gap-3 p-4 rounded-lg border bg-warning/5">
                        <AlertCircle className="text-warning flex-shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusBadge status={anomaly.severity} type="warning" />
                          </div>
                          <p className="text-sm font-medium mb-1">{anomaly.title}</p>
                          <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h3 className="mb-4">Actions prioritaires recommandees</h3>
                <div className="space-y-3">
                  {analysis.actions.map((action, index) => (
                    <div key={index} className="p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusBadge
                              status={action.priority === 'high' ? 'Haute' : action.priority === 'medium' ? 'Moyenne' : 'Basse'}
                              type={action.priority === 'high' ? 'danger' : action.priority === 'medium' ? 'warning' : 'info'}
                            />
                            {action.link && (
                              <a href={action.link} className="text-xs text-primary hover:underline flex items-center gap-1">
                                <LinkIcon size={12} />
                                Voir module
                              </a>
                            )}
                          </div>
                          <p className="text-sm font-medium mb-1">{action.title}</p>
                          <p className="text-sm text-muted-foreground">{action.description}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (action.link) {
                              window.location.href = action.link;
                              return;
                            }
                            toast.success(`Action ouverte: ${action.title}`);
                          }}
                        >
                          Traiter
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="mb-4">Lacunes de donnees</h3>
                <ul className="space-y-2 text-sm">
                  {analysis.dataGaps.map((gap, index) => (
                    <li key={index} className="flex items-start gap-2 text-muted-foreground">
                      <span className="mt-1">•</span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="advanced" className="mt-4">
          <CopilotAvancePage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
