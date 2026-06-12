import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Copy, CheckCircle2, AlertTriangle, TrendingUp, FileText, Database, Clock, Zap, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { DatePresetFilter, DatePreset } from '../components/admin/DatePresetFilter';
import { useRole } from '../contexts/RoleContext';
import { Separator } from '../components/ui/separator';
import { cn } from '../components/ui/utils';
import { AdvancedCopilotAnalysis, analyzeAdvancedCopilotApi } from '../services/api';

interface AnalysisSection {
  id: string;
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
}

const initialSections: AnalysisSection[] = [
  { id: 'main', title: 'Analyse principale', icon: Sparkles, isOpen: true },
  { id: 'insights', title: 'Insights cles', icon: TrendingUp, isOpen: true },
  { id: 'anomalies', title: 'Anomalies detectees', icon: AlertTriangle, isOpen: true },
  { id: 'actions', title: 'Actions prioritaires', icon: CheckCircle2, isOpen: true },
  { id: 'invoices', title: 'Verification factures & devis', icon: FileText, isOpen: false },
  { id: 'facts', title: 'Faits vs hypotheses', icon: Database, isOpen: false },
  { id: 'metadata', title: "Metadonnees d'execution", icon: Clock, isOpen: false },
];

function normalizeConfidencePercent(value: number | string | undefined | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  if (parsed <= 1) {
    return Math.round(parsed * 100);
  }
  return Math.round(parsed);
}

interface CopilotAvancePageProps {
  embedded?: boolean;
}

export function CopilotAvancePage({ embedded = false }: CopilotAvancePageProps) {
  const { role } = useRole();
  const [question, setQuestion] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('30j');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AdvancedCopilotAnalysis | null>(null);
  const [error, setError] = useState('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [sections, setSections] = useState<AnalysisSection[]>(initialSections);

  const toggleSection = (id: string) => {
    setSections((prev) => prev.map((item) => (item.id === id ? { ...item, isOpen: !item.isOpen } : item)));
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await analyzeAdvancedCopilotApi({
        role,
        datePreset,
        question,
        showSystemPrompt,
      });
      setAnalysis(result);
    } catch (e) {
      setAnalysis(null);
      setError(e instanceof Error ? e.message : 'Erreur analyse avancee');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (sectionId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionId);
      setTimeout(() => setCopiedSection(null), 1500);
    } catch (_error) {
      setCopiedSection(null);
    }
  };

  const systemPrompt = `Tu es un assistant IA expert ecommerce pour role=${role}, periode=${datePreset}. Retour strictement une analyse structuree.`;

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1>Copilot Avance</h1>
          <p className="text-muted-foreground">Assistant professionnel pour operations et finance</p>
        </div>
      )}

      {error && (
        <Card className="p-4 border-warning bg-warning/5">
          <p className="text-sm">{error}</p>
        </Card>
      )}

      <Card className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Role actuel</label>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <Badge variant="default">{role}</Badge>
                <span className="text-sm text-muted-foreground">Analyse adaptee a votre role</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Periode d'analyse</label>
            <DatePresetFilter value={datePreset} onChange={(value) => setDatePreset(value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Question ou analyse souhaitee</label>
          <Textarea
            placeholder="Ex: Analyse les performances de vente de ce mois"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <div className="font-medium text-sm">Afficher prompt systeme</div>
            <div className="text-xs text-muted-foreground">Voir les instructions donnees a l'IA</div>
          </div>
          <Switch checked={showSystemPrompt} onCheckedChange={setShowSystemPrompt} />
        </div>

        {showSystemPrompt && (
          <Card className="p-4 bg-muted/50">
            <div className="flex items-start justify-between gap-4 mb-2">
              <Badge variant="outline" className="text-xs">Prompt Systeme</Badge>
              <Button size="sm" variant="ghost" onClick={() => void handleCopy('system', systemPrompt)}>
                {copiedSection === 'system' ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
              </Button>
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{systemPrompt}</pre>
          </Card>
        )}

        <Button className="w-full gap-2" size="lg" onClick={() => void handleAnalyze()} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Lancer l'analyse
            </>
          )}
        </Button>
      </Card>

      {(analysis || isLoading) && (
        <div className="space-y-4">
          {isLoading && !analysis && (
            <Card className="p-6 text-sm text-muted-foreground">Generation des sections d'analyse...</Card>
          )}

          {analysis &&
            sections.map((section) => {
              const Icon = section.icon;
              return (
                <Card key={section.id}>
                  <Collapsible open={section.isOpen} onOpenChange={() => toggleSection(section.id)}>
                    <CollapsibleTrigger className="w-full">
                      <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon size={20} className="text-primary" />
                          </div>
                          <h3 className="font-medium">{section.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {section.id === 'main' && (
                            <div className="inline-flex items-center justify-center h-8 px-3 rounded-md text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCopy(section.id, analysis.mainAnalysis);
                              }}
                            >
                              {copiedSection === section.id ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                            </div>
                          )}
                          {section.isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4">
                        <Separator className="mb-4" />

                        {section.id === 'main' && <p className="text-sm whitespace-pre-line text-foreground">{analysis.mainAnalysis}</p>}

                        {section.id === 'insights' && (
                          <div className="space-y-3">
                            {analysis.keyInsights.map((insight, idx) => (
                              <Card key={idx} className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className={cn('h-2 w-2 rounded-full mt-2', insight.impact === 'high' ? 'bg-green-500' : 'bg-yellow-500')} />
                                  <div className="flex-1">
                                    <div className="font-medium mb-1">{insight.title}</div>
                                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                                  </div>
                                  <Badge variant={insight.impact === 'high' ? 'default' : 'secondary'}>
                                    {insight.impact === 'high' ? 'Impact eleve' : 'Impact moyen'}
                                  </Badge>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}

                        {section.id === 'anomalies' && (
                          <div className="space-y-3">
                            {analysis.anomalies.map((anomaly, idx) => (
                              <Card key={idx} className={cn('p-4', anomaly.severity === 'critical' ? 'border-destructive' : 'border-yellow-500')}>
                                <div className="flex items-start gap-3">
                                  <AlertTriangle className={cn('mt-1', anomaly.severity === 'critical' ? 'text-destructive' : 'text-yellow-500')} size={20} />
                                  <div className="flex-1">
                                    <div className="font-medium mb-1">{anomaly.title}</div>
                                    <p className="text-sm text-muted-foreground mb-2">{anomaly.description}</p>
                                    <div className="flex items-center gap-2">
                                      <Zap size={14} className="text-primary" />
                                      <span className="text-sm font-medium">Action: {anomaly.action}</span>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}

                        {section.id === 'actions' && (
                          <div className="space-y-3">
                            {analysis.priorityActions.map((action, idx) => (
                              <Card key={idx} className="p-4 hover:bg-muted/50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">{action.title}</span>
                                      <Badge variant={action.priority === 'high' ? 'destructive' : 'default'}>
                                        {action.priority === 'high' ? 'Urgent' : 'Moyen'}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{action.description}</p>
                                  </div>
                                  <Button size="sm" variant="outline" className="gap-2" onClick={() => (window.location.href = action.link || '/admin')}>
                                    <LinkIcon size={14} />
                                    Acceder
                                  </Button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}

                        {section.id === 'invoices' && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                              <Card className="p-4"><div className="text-2xl font-bold">{analysis.invoiceCheck.totalInvoices}</div><div className="text-sm text-muted-foreground">Total factures</div></Card>
                              <Card className="p-4"><div className="text-2xl font-bold text-green-500">{analysis.invoiceCheck.verifiedInvoices}</div><div className="text-sm text-muted-foreground">Verifiees</div></Card>
                              <Card className="p-4"><div className="text-2xl font-bold text-yellow-500">{analysis.invoiceCheck.pendingInvoices}</div><div className="text-sm text-muted-foreground">En attente</div></Card>
                            </div>
                            {analysis.invoiceCheck.issues.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2 text-sm">Problemes detectes</h4>
                                <div className="space-y-2">
                                  {analysis.invoiceCheck.issues.map((issue, idx) => (
                                    <div key={idx} className="p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
                                      <p className="text-sm">{issue}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {section.id === 'facts' && (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="border-b">
                                <tr>
                                  <th className="text-left p-3 text-sm font-medium">Affirmation</th>
                                  <th className="text-left p-3 text-sm font-medium">Type</th>
                                  <th className="text-left p-3 text-sm font-medium">Confiance</th>
                                  <th className="text-left p-3 text-sm font-medium">Source</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analysis.factsVsHypothesis.map((item, idx) => (
                                  <tr key={idx} className="border-b">
                                    <td className="p-3 text-sm">{item.statement}</td>
                                    <td className="p-3"><Badge variant={item.type === 'fact' ? 'default' : 'secondary'}>{item.type === 'fact' ? 'Fait' : 'Hypothese'}</Badge></td>
                                    <td className="p-3">
                                      {(() => {
                                        const confidencePercent = normalizeConfidencePercent(item.confidence);
                                        return (
                                      <div className="flex items-center gap-2">
                                        <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                                          <div className={cn('h-2 rounded-full', confidencePercent >= 80 ? 'bg-green-500' : confidencePercent >= 60 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${confidencePercent}%` }} />
                                        </div>
                                        <span className="text-sm font-medium">{confidencePercent}%</span>
                                      </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="p-3 text-sm text-muted-foreground">{item.source}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {section.id === 'metadata' && (
                          <div className="grid grid-cols-2 gap-4">
                            <Card className="p-4"><div className="text-sm text-muted-foreground mb-1">Temps d'execution</div><div className="font-medium">{analysis.metadata.executionTime}</div></Card>
                            <Card className="p-4"><div className="text-sm text-muted-foreground mb-1">Points de donnees</div><div className="font-medium">{analysis.metadata.dataPoints || 'N/A'}</div></Card>
                            <Card className="p-4"><div className="text-sm text-muted-foreground mb-1">Modeles utilises</div><div className="font-medium">{analysis.metadata.modelsUsed.join(', ')}</div></Card>
                            <Card className="p-4"><div className="text-sm text-muted-foreground mb-1">Confiance globale</div><div className="font-medium">{normalizeConfidencePercent(analysis.metadata.confidence)}%</div></Card>
                            <Card className="p-4 col-span-2"><div className="text-sm text-muted-foreground mb-1">Derniere mise a jour</div><div className="font-medium">{analysis.metadata.lastUpdate}</div></Card>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
