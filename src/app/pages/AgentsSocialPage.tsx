import { useEffect, useMemo, useState } from 'react';
import { Send, Phone, Video, Info, Smile, Paperclip, Image as ImageIcon, CheckCheck, MessageSquare, Loader2, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { cn } from '../components/ui/utils';
import { toast } from 'sonner';
import {
  AgentRule,
  AgentsSettings,
  Channel,
  ConversationRecord,
  MessageRecord,
  SocialAgentAnalysis,
  createAgentRuleApi,
  deleteAgentRuleApi,
  fetchAgentChannelsApi,
  fetchAgentConversationsApi,
  fetchAgentMessagesApi,
  fetchAgentRulesApi,
  fetchAgentSettingsApi,
  fetchAgentSuggestionApi,
  sendAgentMessageApi,
  updateAgentConversationApi,
  updateAgentRuleApi,
  updateAgentSettingsApi,
} from '../services/api';

const channelIcons = {
  facebook: '📘',
  instagram: '📷',
  whatsapp: '💬',
  manual: '👤',
};

const channelNames = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  manual: 'Manual',
};

export function AgentsSocialPage() {
  const [selectedChannel, setSelectedChannel] = useState<Channel>('whatsapp');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [settings, setSettings] = useState<AgentsSettings>({ autoReplyEnabled: true, tone: 'professionnel', language: 'fr' });
  const [rules, setRules] = useState<AgentRule[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiSuggestionAnalysis, setAiSuggestionAnalysis] = useState<SocialAgentAnalysis | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [channelStats, setChannelStats] = useState<Array<{ channel: Channel; total: number; unread: number }>>([]);

  const loadConversationList = async (channel: Channel) => {
    const [rows, stats] = await Promise.all([fetchAgentConversationsApi(channel), fetchAgentChannelsApi()]);
    setConversations(rows);
    setChannelStats(stats);
    const nextSelected = rows[0]?.id || null;
    setSelectedConversation((prev) => (prev && rows.find((row) => row.id === prev) ? prev : nextSelected));
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [settingsData, rulesData] = await Promise.all([fetchAgentSettingsApi(), fetchAgentRulesApi()]);
        if (!active) return;
        setSettings(settingsData);
        setRules(rulesData);
        await loadConversationList(selectedChannel);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadConversationList(selectedChannel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel]);

  useEffect(() => {
    let active = true;
    const loadMessages = async () => {
      if (!selectedConversation) {
        setMessages([]);
        return;
      }
      try {
        const rows = await fetchAgentMessagesApi(selectedConversation);
        if (active) {
          setMessages(rows);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'Erreur de chargement des messages');
        }
      }
    };
    void loadMessages();
    return () => {
      active = false;
    };
  }, [selectedConversation]);

  useEffect(() => {
    let active = true;
    const loadSuggestion = async () => {
      if (!selectedConversation || !settings.autoReplyEnabled) {
        setAiSuggestion('');
        setAiSuggestionAnalysis(null);
        return;
      }
      try {
        const payload = await fetchAgentSuggestionApi(selectedConversation);
        if (active) {
          setAiSuggestion(payload.text);
          setAiSuggestionAnalysis(payload.analysis || null);
        }
      } catch (_error) {
        if (active) {
          setAiSuggestion('');
          setAiSuggestionAnalysis(null);
        }
      }
    };
    void loadSuggestion();
    return () => {
      active = false;
    };
  }, [selectedConversation, settings.autoReplyEnabled, settings.language, settings.tone]);

  const currentConversation = useMemo(
    () => conversations.find((entry) => entry.id === selectedConversation) || null,
    [conversations, selectedConversation]
  );

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((entry) => {
      const haystacks = [entry.contact, entry.lastMessage, channelNames[entry.channel]];
      return haystacks.some((value) => value.toLowerCase().includes(query));
    });
  }, [conversationSearch, conversations]);

  const totalUnread = useMemo(
    () => channelStats.reduce((sum, entry) => sum + Number(entry.unread || 0), 0),
    [channelStats]
  );

  const totalConversations = useMemo(
    () => channelStats.reduce((sum, entry) => sum + Number(entry.total || 0), 0),
    [channelStats]
  );

  const handleSendMessage = async () => {
    if (!selectedConversation || !messageInput.trim()) {
      return;
    }

    const outgoing = messageInput.trim();
    setMessageInput('');
    setIsTyping(true);

    try {
      await sendAgentMessageApi(selectedConversation, outgoing, 'user');
      const rows = await fetchAgentMessagesApi(selectedConversation);
      setMessages(rows);
      setAiSuggestion('');
      setAiSuggestionAnalysis(null);
      await loadConversationList(selectedChannel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'envoi du message");
    } finally {
      setIsTyping(false);
    }
  };

  const useAiSuggestion = () => {
    setMessageInput(aiSuggestion);
  };

  const sendAiSuggestion = async () => {
    if (!selectedConversation || !aiSuggestion.trim()) {
      return;
    }

    setMessageInput('');
    setIsTyping(true);

    try {
      await sendAgentMessageApi(selectedConversation, aiSuggestion.trim(), 'user');
      const rows = await fetchAgentMessagesApi(selectedConversation);
      setMessages(rows);
      setAiSuggestion('');
      setAiSuggestionAnalysis(null);
      await loadConversationList(selectedChannel);
      toast.success("Réponse IA envoyée");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'envoi de la suggestion IA");
    } finally {
      setIsTyping(false);
    }
  };

  const patchSettings = async (patch: Partial<AgentsSettings>) => {
    const previous = settings;
    const optimistic = { ...previous, ...patch };
    setSettings(optimistic);
    try {
      const saved = await updateAgentSettingsApi(patch);
      setSettings(saved);
    } catch (e) {
      setSettings(previous);
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde des paramètres');
    }
  };

  const handleToggleRule = async (rule: AgentRule, active: boolean) => {
    setRules((prev) => prev.map((entry) => (entry.id === rule.id ? { ...entry, active } : entry)));
    try {
      await updateAgentRuleApi(rule.id, { active });
    } catch (_error) {
      setRules((prev) => prev.map((entry) => (entry.id === rule.id ? { ...entry, active: !active } : entry)));
    }
  };

  const handleAddRule = async () => {
    try {
      const created = await createAgentRuleApi({
        contains: 'commande',
        action: 'Créer un brouillon de commande',
        active: true,
        triggers: 0,
      });
      setRules((prev) => [...prev, created]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter une règle");
    }
  };

  const handleDeleteRule = async (id: string) => {
    const previous = rules;
    setRules((prev) => prev.filter((entry) => entry.id !== id));
    try {
      await deleteAgentRuleApi(id);
    } catch (_error) {
      setRules(previous);
    }
  };

  useEffect(() => {
    let active = true;

    const markConversationAsRead = async () => {
      if (!currentConversation || currentConversation.unread <= 0) {
        return;
      }

      setConversations((prev) =>
        prev.map((entry) => (entry.id === currentConversation.id ? { ...entry, unread: 0 } : entry))
      );
      setChannelStats((prev) =>
        prev.map((entry) =>
          entry.channel === currentConversation.channel
            ? { ...entry, unread: Math.max(0, entry.unread - currentConversation.unread) }
            : entry
        )
      );

      try {
        await updateAgentConversationApi(currentConversation.id, { unread: 0 });
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'Erreur de mise a jour de la conversation');
          await loadConversationList(selectedChannel);
        }
      }
    };

    void markConversationAsRead();

    return () => {
      active = false;
    };
  }, [currentConversation, selectedChannel]);

  return (
    <div className="space-y-6">
      <div>
        <h1>Agent social IA</h1>
        <p className="text-muted-foreground">Automatisez vos réponses aux messages clients</p>
      </div>

      {error && (
        <Card className="p-3 border-warning bg-warning/5">
          <p className="text-sm">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:h-[calc(100vh-15rem)] lg:min-h-[38rem]">
        <Card className="lg:col-span-2 p-4">
          <h3 className="font-medium mb-4 text-sm">Canaux</h3>
          <div className="space-y-2">
            {(['whatsapp', 'facebook', 'instagram'] as Channel[]).map((channel) => {
              const stat = channelStats.find((entry) => entry.channel === channel);
              return (
                <button
                  key={channel}
                  onClick={() => setSelectedChannel(channel)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                    selectedChannel === channel ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  )}
                >
                  <span className="text-2xl">{channelIcons[channel]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{channelNames[channel]}</div>
                    <div className={cn('text-xs', selectedChannel === channel ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                      {stat?.total || 0} conv.
                    </div>
                  </div>
                  {(stat?.unread || 0) > 0 && <Badge variant="destructive" className="text-xs">{stat?.unread}</Badge>}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-6 flex min-h-0 flex-col overflow-hidden">
          <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-5">
            <div className="flex min-h-0 flex-col border-b xl:col-span-2 xl:border-r xl:border-b-0">
              <div className="p-4 border-b">
                <Input
                  placeholder="Rechercher..."
                  value={conversationSearch}
                  onChange={(event) => setConversationSearch(event.target.value)}
                  className="h-9"
                />
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="p-2">
                  {filteredConversations.length > 0 ? (
                    filteredConversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={cn(
                          'mb-1 flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
                          selectedConversation === conv.id ? 'bg-primary/10' : 'hover:bg-accent'
                        )}
                      >
                        <div className="text-2xl">{conv.avatar}</div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <div className="font-medium text-sm truncate">{conv.contact}</div>
                            <span className="text-xs text-muted-foreground">{conv.timestamp}</span>
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{conv.lastMessage}</div>
                        </div>
                        {conv.unread > 0 && <Badge variant="default" className="text-xs h-5 px-1.5">{conv.unread}</Badge>}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Aucune conversation ne correspond a votre recherche.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="flex min-h-0 flex-col xl:col-span-3">
              {!selectedConversation || !currentConversation ? (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                  <div>
                    <MessageSquare size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Sélectionnez une conversation pour commencer</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{currentConversation.avatar}</div>
                      <div>
                        <div className="font-medium">{currentConversation.contact}</div>
                        <div className="text-xs text-muted-foreground">En ligne</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => toast.info('Appel vocal bientôt disponible')}><Phone size={18} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => toast.info('Appel vidéo bientôt disponible')}><Video size={18} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => toast.info('Informations de conversation affichées dans le panneau de droite')}><Info size={18} /></Button>
                    </div>
                  </div>

                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-4 p-4">
                      {messages.map((msg) => (
                        <div key={msg.id} className={cn('flex', msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                          <div className={cn('max-w-[80%] rounded-lg px-4 py-2', msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                            <p className="text-sm">{msg.text}</p>
                            <div className={cn('flex items-center gap-1 justify-end mt-1 text-xs', msg.sender === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                              <span>{msg.timestamp}</span>
                              {msg.sender === 'user' && msg.status === 'read' && <CheckCheck size={14} />}
                            </div>
                          </div>
                        </div>
                      ))}

                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-lg px-4 py-2">
                            <Loader2 size={16} className="animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {settings.autoReplyEnabled && aiSuggestion && (
                    <div className="p-3 border-t bg-accent/50">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="default" className="text-xs">IA</Badge>
                            <span className="text-xs text-muted-foreground">Suggestion de réponse</span>
                          </div>
                          <p className="text-sm">{aiSuggestion}</p>
                          {aiSuggestionAnalysis && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[11px]">
                                Intent: {aiSuggestionAnalysis.intent}
                              </Badge>
                              <Badge variant="outline" className="text-[11px]">
                                Langue: {aiSuggestionAnalysis.language}
                              </Badge>
                              {aiSuggestionAnalysis.language_variant === 'tunisian_dialect' && (
                                <Badge variant="outline" className="text-[11px]">
                                  Dialecte: Tunisien
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[11px]">
                                Confiance: {Math.round(Number(aiSuggestionAnalysis.confidence || 0) * 100)}%
                              </Badge>
                              <Badge variant="outline" className="text-[11px]">
                                Action: {aiSuggestionAnalysis.suggested_action}
                              </Badge>
                              {aiSuggestionAnalysis.needs_human && (
                                <Badge variant="destructive" className="text-[11px]">
                                  Escalade humaine requise
                                </Badge>
                              )}
                            </div>
                          )}
                          {aiSuggestionAnalysis?.needs_human && aiSuggestionAnalysis.human_reason && (
                            <p className="mt-2 text-xs text-warning">{aiSuggestionAnalysis.human_reason}</p>
                          )}
                        </div>
                        <div className="flex gap-1 self-end sm:self-auto">
                          <Button size="sm" variant="ghost" onClick={useAiSuggestion}>Utiliser</Button>
                          <Button size="sm" onClick={() => void sendAiSuggestion()}>Envoyer</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAiSuggestion(''); setAiSuggestionAnalysis(null); }}>
                            Masquer
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4 border-t">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => toast.info('Ajout de document bientôt disponible')}><Paperclip size={18} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => toast.info("Envoi d'image bientôt disponible")}><ImageIcon size={18} /></Button>
                  <Input
                        placeholder="Tapez un message..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                        className="min-w-[12rem] flex-1"
                      />
                      <Button variant="ghost" size="icon" onClick={() => toast.info("Sélecteur d'emojis bientôt disponible")}><Smile size={18} /></Button>
                      <Button onClick={() => void handleSendMessage()} size="icon"><Send size={18} /></Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-4 p-6 space-y-6 overflow-y-auto min-h-0">
          <div>
            <h3 className="font-medium mb-4">Paramètres IA</h3>

            <div className="flex items-center justify-between p-4 rounded-lg border mb-4">
              <div>
                <div className="font-medium text-sm">Réponse automatique</div>
                <div className="text-xs text-muted-foreground">Activer l'IA pour répondre automatiquement</div>
              </div>
              <Switch checked={settings.autoReplyEnabled} onCheckedChange={(value) => void patchSettings({ autoReplyEnabled: value })} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ton de communication</label>
              <Tabs value={settings.tone} onValueChange={(value) => void patchSettings({ tone: value as AgentsSettings['tone'] })}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="professionnel" className="text-xs">Professionnel</TabsTrigger>
                  <TabsTrigger value="amical" className="text-xs">Amical</TabsTrigger>
                  <TabsTrigger value="commercial" className="text-xs">Commercial</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Langue</label>
              <Select value={settings.language} onValueChange={(value) => void patchSettings({ language: value as AgentsSettings['language'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="ar">Arabe</SelectItem>
                  <SelectItem value="en">Anglais</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-medium mb-4">Règles automatiques</h3>

            <div className="space-y-3">
              {rules.map((rule) => (
                <Card key={rule.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Si le message contient "{rule.contains}"</span>
                    <div className="flex items-center gap-2">
                      <Switch checked={rule.active} onCheckedChange={(value) => void handleToggleRule(rule, value)} />
                      <Button variant="ghost" size="icon" aria-label="Supprimer la règle" onClick={() => void handleDeleteRule(rule.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">→ {rule.action}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{rule.active ? 'Actif' : 'Inactif'}</Badge>
                    <span className="text-xs text-muted-foreground">{rule.triggers} déclenchements</span>
                  </div>
                </Card>
              ))}
            </div>

            <Button variant="outline" className="w-full mt-4" onClick={() => void handleAddRule()}>
              + Ajouter une règle
            </Button>
          </div>

          <Separator />

          <div>
            <h3 className="font-medium mb-4">Statistiques aujourd'hui</h3>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <div className="text-2xl font-bold">{totalConversations}</div>
                <div className="text-xs text-muted-foreground">Conversations</div>
              </Card>
              <Card className="p-3">
                <div className="text-2xl font-bold">{totalUnread}</div>
                <div className="text-xs text-muted-foreground">Messages non lus</div>
              </Card>
            </div>
          </div>
        </Card>
      </div>

      {isLoading && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Chargement des données...</p>
        </Card>
      )}
    </div>
  );
}
