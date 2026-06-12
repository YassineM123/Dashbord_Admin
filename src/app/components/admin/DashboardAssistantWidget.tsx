import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, MessageCircle, Mic, MicOff, Plus, SendHorizontal, Smile, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../ui/utils';
import {
  chatWithDashboardAssistantApi,
  DashboardAssistantLanguage,
  DashboardAssistantMode,
  DashboardAssistantResponse,
  DashboardAssistantTurn,
} from '../../services/api';

interface ChatMessage extends DashboardAssistantTurn {
  id: string;
  timestamp: string;
  mode?: DashboardAssistantResponse['mode'];
}

const STARTER_PROMPTS: Record<DashboardAssistantLanguage, string[]> = {
  en: [
    'Build me a 7-day marketing strategy',
    'What KPI should I track today?',
    'Give me campaign ideas for this week',
  ],
  fr: [
    'Construit-moi une strategie marketing sur 7 jours',
    'Quel KPI dois-je suivre aujourd hui ?',
    'Donne-moi des idees de campagne cette semaine',
  ],
  ar: ['Build me a 7-day marketing strategy', 'What KPI should I track today?', 'Give me campaign ideas for this week'],
};

const AGENT_PROMPTS: Record<DashboardAssistantLanguage, string[]> = {
  en: ['Show my sales summary', 'Which product is most requested?', 'Give stock and lead alerts'],
  fr: ['Montre un resume des ventes', 'Quel produit est le plus demande?', 'Donne les alertes stock et leads'],
  ar: ['Show my sales summary', 'Which product is most requested?', 'Give stock and lead alerts'],
};

const UI_TEXT: Record<
  DashboardAssistantLanguage,
  {
    title: string;
    connected: string;
    fallback: string;
    placeholder: string;
    hint: string;
    voiceUnavailable: string;
    thinking: string;
    send: string;
    poweredBy: string;
    welcome: string;
    assistantLabel: string;
    agentLabel: string;
    assistantActive: string;
    agentActive: string;
  }
> = {
  en: {
    title: 'ChatBot',
    connected: 'AI connected',
    fallback: 'Smart fallback mode',
    placeholder: 'Type a message...',
    hint: 'Ask strategy, campaigns, KPI',
    voiceUnavailable: 'Voice input is not available in this browser.',
    thinking: 'Thinking...',
    send: 'Send message',
    poweredBy: 'Powered by Dashboard Assistant',
    welcome:
      'Hi, I am your dashboard assistant. Ask me about marketing strategy, sales growth, campaigns, or KPI actions.',
    assistantLabel: 'Assistant',
    agentLabel: 'Agent',
    assistantActive: 'Assistant mode',
    agentActive: 'Agent mode',
  },
  fr: {
    title: 'ChatBot',
    connected: 'IA connectee',
    fallback: 'Mode intelligent local',
    placeholder: 'Ecrire un message...',
    hint: 'Demandez strategie, campagnes, KPI',
    voiceUnavailable: "La saisie vocale n'est pas disponible sur ce navigateur.",
    thinking: 'Analyse en cours...',
    send: 'Envoyer le message',
    poweredBy: 'Propulse par Dashboard Assistant',
    welcome:
      "Bonjour, je suis votre assistant dashboard. Je peux aider pour la strategie marketing, la croissance des ventes, les campagnes et les actions KPI.",
    assistantLabel: 'Assistant',
    agentLabel: 'Agent',
    assistantActive: 'Mode assistant',
    agentActive: 'Mode agent',
  },
  ar: {
    title: 'ChatBot',
    connected: 'AI connected',
    fallback: 'Smart fallback mode',
    placeholder: 'Type a message...',
    hint: 'Ask strategy, campaigns, KPI',
    voiceUnavailable: 'Voice input is not available in this browser.',
    thinking: 'Thinking...',
    send: 'Send message',
    poweredBy: 'Powered by Dashboard Assistant',
    welcome:
      'Hi, I am your dashboard assistant. Ask me about marketing strategy, sales growth, campaigns, or KPI actions.',
    assistantLabel: 'Assistant',
    agentLabel: 'Agent',
    assistantActive: 'Assistant mode',
    agentActive: 'Agent mode',
  },
};

function createMessageId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowLabel() {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function detectLanguage(input: string): DashboardAssistantLanguage {
  const text = input.trim();
  if (!text) return 'en';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  const lowered = text.toLowerCase();
  if (/(bonjour|salut|strategie|campagne|ventes|tableau de bord|indicateur|merci|aide)/.test(lowered)) {
    return 'fr';
  }
  return 'en';
}

function getPreferredLanguage(): DashboardAssistantLanguage {
  if (typeof window === 'undefined') {
    return 'en';
  }
  const locale = (window.navigator.language || '').toLowerCase();
  if (locale.startsWith('fr')) return 'fr';
  if (locale.startsWith('ar')) return 'ar';
  return 'en';
}

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') {
    return null;
  }
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function getSpeechLocale(language: DashboardAssistantLanguage) {
  if (language === 'fr') return 'fr-FR';
  if (language === 'ar') return 'ar-TN';
  return 'en-US';
}

function createWelcomeMessage(language: DashboardAssistantLanguage): ChatMessage {
  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    content: UI_TEXT[language].welcome,
    timestamp: nowLabel(),
    mode: 'fallback',
  };
}

function resolvePrompts(language: DashboardAssistantLanguage, assistantMode: DashboardAssistantMode) {
  return assistantMode === 'agent' ? AGENT_PROMPTS[language] : STARTER_PROMPTS[language];
}

function buildOfflineReply(
  message: string,
  language: DashboardAssistantLanguage,
  assistantMode: DashboardAssistantMode
) {
  if (assistantMode === 'agent') {
    if (language === 'fr') {
      return 'Mode agent actif. Acces dashboard indisponible temporairement, reessayez pour obtenir votre resume ventes, stock et leads.';
    }
    return 'Agent mode is active. Dashboard access is temporarily unavailable, please retry for your sales, stock, and leads summary.';
  }

  const lowered = message.toLowerCase();
  if (/(kpi|dashboard|analytics|funnel|indicateur|tableau de bord)/.test(lowered)) {
    if (language === 'fr') {
      return 'Mode local: suivez 5 KPI: chiffre affaires, taux conversion, panier moyen, CAC, taux reachat. Si un KPI baisse, comparez source trafic, landing page et checkout.';
    }
    return 'Offline mode: track revenue, conversion rate, AOV, CAC, and repeat purchase rate. If one drops, review traffic source, landing page, and checkout first.';
  }

  if (/(marketing|campaign|campagne|ads|pub|seo|acquisition)/.test(lowered)) {
    if (language === 'fr') {
      return 'Mode local: plan rapide 7 jours. J1 objectif+audience, J2 offre+angle, J3 creatives, J4 pages, J5 email+retargeting, J6 optimisation, J7 bilan.';
    }
    return 'Offline mode: quick 7-day plan. D1 goal+audience, D2 offer+angle, D3 creatives, D4 landing pages, D5 email+retargeting, D6 optimization, D7 review.';
  }

  if (language === 'fr') {
    return 'Mode local actif: partagez votre objectif (ventes, conversion, retention ou contenu) et je retourne un plan en 3 etapes.';
  }
  return 'Offline mode active: share your goal (sales, conversion, retention, or content) and I will return a 3-step action plan.';
}

export function DashboardAssistantWidget() {
  const initialLanguage = getPreferredLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [uiLanguage, setUiLanguage] = useState<DashboardAssistantLanguage>(initialLanguage);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage(initialLanguage)]);
  const [quickPrompts, setQuickPrompts] = useState<string[]>(STARTER_PROMPTS[initialLanguage]);
  const [sending, setSending] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'ai' | 'fallback'>('fallback');
  const [assistantMode, setAssistantMode] = useState<DashboardAssistantMode>('assistant');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognitionCtor()));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending, open]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const text = useMemo(() => UI_TEXT[uiLanguage], [uiLanguage]);
  const canSend = useMemo(() => draft.trim().length > 0 && !sending, [draft, sending]);

  const stopVoiceCapture = () => {
    if (!recognitionRef.current) {
      return;
    }
    recognitionRef.current.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const setMode = (nextMode: DashboardAssistantMode) => {
    if (sending) {
      return;
    }
    setAssistantMode(nextMode);
    setQuickPrompts(resolvePrompts(uiLanguage, nextMode));
  };

  const toggleVoiceCapture = () => {
    if (isListening) {
      stopVoiceCapture();
      return;
    }

    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition || sending) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getSpeechLocale(uiLanguage);
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results || [])
        .map((result: any) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      setDraft(transcript);
      if (transcript) {
        setUiLanguage(detectLanguage(transcript));
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const sendMessage = async (inputText: string) => {
    const cleanText = inputText.trim();
    if (!cleanText || sending) {
      return;
    }

    if (isListening) {
      stopVoiceCapture();
    }

    const guessedLanguage = detectLanguage(cleanText);
    setUiLanguage(guessedLanguage);
    setQuickPrompts(resolvePrompts(guessedLanguage, assistantMode));

    const userMessage: ChatMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: cleanText,
      timestamp: nowLabel(),
    };

    const nextHistory: DashboardAssistantTurn[] = [...messages, userMessage]
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    setMessages((prev) => [...prev, userMessage]);
    setDraft('');
    setSending(true);

    try {
      const response = await chatWithDashboardAssistantApi({
        message: cleanText,
        history: nextHistory,
        mode: assistantMode,
      });

      const assistantMessage: ChatMessage = {
        id: createMessageId('assistant'),
        role: 'assistant',
        content: response.reply,
        timestamp: nowLabel(),
        mode: response.mode,
      };

      const resolvedLanguage = response.language || guessedLanguage;
      const resolvedAssistantMode = response.assistantMode || assistantMode;

      setMessages((prev) => [...prev, assistantMessage]);
      setConnectionMode(response.mode);
      setAssistantMode(resolvedAssistantMode);
      setUiLanguage(resolvedLanguage);
      setQuickPrompts(
        response.suggestions.length > 0 ? response.suggestions : resolvePrompts(resolvedLanguage, resolvedAssistantMode)
      );
    } catch (_error) {
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId('assistant'),
          role: 'assistant',
          content: buildOfflineReply(cleanText, guessedLanguage, assistantMode),
          timestamp: nowLabel(),
          mode: 'fallback',
        },
      ]);
      setConnectionMode('fallback');
      setQuickPrompts(resolvePrompts(guessedLanguage, assistantMode));
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  return (
    <>
      {open && (
        <section
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-2 z-[60] w-[calc(100vw-1rem)] sm:right-4 sm:w-[390px]"
          dir={uiLanguage === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-[#f3f4f6] shadow-[0_24px_55px_rgba(15,23,42,0.24)]">
            <div className="border-b border-zinc-200 bg-white/95 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-zinc-300" />
                  <span className="h-2 w-2 rounded-full bg-zinc-300" />
                  <span className="h-2 w-2 rounded-full bg-zinc-300" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setOpen(false)}>
                  <X size={15} />
                </Button>
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2f6df6] text-white shadow">
                  <Bot size={15} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{text.title}</p>
                  <p className="text-[11px] text-zinc-500">
                    {connectionMode === 'ai' ? text.connected : text.fallback} -{' '}
                    {assistantMode === 'agent' ? text.agentActive : text.assistantActive}
                  </p>
                </div>
              </div>

              <div className="mt-2 inline-flex rounded-full bg-zinc-100 p-1">
                <button
                  type="button"
                  className={cn(
                    'rounded-full px-3 py-1 text-xs transition',
                    assistantMode === 'assistant' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-800'
                  )}
                  onClick={() => setMode('assistant')}
                  disabled={sending}
                >
                  {text.assistantLabel}
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded-full px-3 py-1 text-xs transition',
                    assistantMode === 'agent' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-800'
                  )}
                  onClick={() => setMode('agent')}
                  disabled={sending}
                >
                  {text.agentLabel}
                </button>
              </div>
            </div>

            <ScrollArea className="h-[min(360px,50vh)] px-4 py-4 sm:h-[360px]">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={cn('flex items-end gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {message.role === 'assistant' && (
                      <div className="mb-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#2f6df6] text-white shadow-sm">
                        <Bot size={13} />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                        message.role === 'user'
                          ? 'rounded-tr-md border border-zinc-200 bg-white text-zinc-900'
                          : 'rounded-bl-md bg-zinc-900 text-zinc-100'
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      <p className={cn('mt-1 text-[10px]', message.role === 'user' ? 'text-zinc-400' : 'text-zinc-400')}>
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-full bg-zinc-200 px-3 py-2 text-xs text-zinc-600">
                      <Loader2 size={12} className="animate-spin" />
                      {text.thinking}
                    </div>
                  </div>
                )}

                <div ref={endRef} />
              </div>
            </ScrollArea>

            <div className="space-y-2 border-t border-zinc-200 bg-white px-3 py-3">
              <div className="flex flex-wrap gap-2">
                {quickPrompts.slice(0, 2).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                    onClick={() => void sendMessage(prompt)}
                    disabled={sending}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <form
                onSubmit={onSubmit}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-1.5 py-1.5 sm:gap-2 sm:px-2 sm:py-2"
              >
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-500">
                  <Plus size={15} />
                </Button>
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={text.placeholder}
                  className="h-8 min-w-0 border-0 bg-transparent px-0 py-0 text-[15px] leading-5 shadow-none focus-visible:ring-0"
                  disabled={sending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 rounded-full',
                    isListening ? 'bg-[#2f6df6] text-white hover:bg-[#2f6df6]' : 'text-zinc-500'
                  )}
                  onClick={toggleVoiceCapture}
                  disabled={!voiceSupported || sending}
                  title={voiceSupported ? text.hint : text.voiceUnavailable}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-500">
                  <Smile size={15} />
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-zinc-900 text-white hover:bg-zinc-800"
                  disabled={!canSend}
                  title={text.send}
                >
                  <SendHorizontal size={14} />
                </Button>
              </form>

              {!voiceSupported && <p className="text-[11px] text-zinc-500">{text.voiceUnavailable}</p>}

              <p className="text-center text-[10px] text-zinc-400">{text.poweredBy}</p>
            </div>
          </div>
        </section>
      )}

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-4 z-[60] h-14 w-14 rounded-full bg-[#2f6df6] text-white shadow-[0_18px_30px_rgba(47,109,246,0.45)] hover:bg-[#245de0]"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={20} /> : <MessageCircle size={22} />}
        <span className="sr-only">Toggle dashboard assistant</span>
      </Button>
    </>
  );
}
