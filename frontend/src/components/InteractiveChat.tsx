import { useState, useEffect, useRef } from "react";
import type React from "react";
import { MessageSquare, Send, Bot, User, RefreshCw, Copy, Check, History } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AnalysisData, Message } from "../types/analysis";
import apiClient from "../api/client";

interface InteractiveChatProps {
  currentAnalysis: AnalysisData | null;
}

const PRESET_VIDEO_QUESTIONS = [
  "What are the main decisions made in this video?",
  "List all action items with assigned tasks.",
  "Summarize the technical architecture in 3 points.",
  "What are the key risks or open questions mentioned?"
];

const PRESET_PDF_QUESTIONS = [
  "Summarize the executive findings of this document.",
  "What are the primary action items and deadlines?",
  "Extract key architectural or strategic decisions.",
  "What potential risks or open questions are noted?"
];

export const InteractiveChat: React.FC<InteractiveChatProps> = ({ currentAnalysis }) => {
  const isPdf = currentAnalysis?.type === "pdf";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      sender: "assistant",
      text: currentAnalysis
        ? `Hello! I have analyzed "${currentAnalysis.title}". Ask me anything about the content, key takeaways, decisions, or timestamps!`
        : "Hello! Select or analyze a video, audio recording, or PDF document above, then ask me anything about the content.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // Load chat history when analysis changes
  useEffect(() => {
    if (currentAnalysis) {
      const initMessage: Message = {
        id: "init-analysis",
        sender: "assistant",
        text: `Loaded analysis for "${currentAnalysis.title}". I'm ready to answer any questions based on the full ${
          currentAnalysis.type === "pdf" ? "document content" : "transcript"
        }!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      // Load past conversation history from backend
      const sessionId = currentAnalysis.job_id;
      if (sessionId) {
        setHistoryLoaded(false);
        apiClient.getChatHistory(sessionId)
          .then((data) => {
            if (data.messages && data.messages.length > 0) {
              // Convert backend messages to frontend Message format
              const pastMessages: Message[] = data.messages.map((msg: any, idx: number) => ({
                id: `history-${idx}`,
                sender: msg.role === "user" ? "user" : "assistant",
                text: msg.content,
                timestamp: msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ""
              }));
              // Prepend the init message, then past messages
              setMessages([initMessage, ...pastMessages]);
            } else {
              setMessages([initMessage]);
            }
            setHistoryLoaded(true);
          })
          .catch((err) => {
            console.warn("Could not load chat history:", err);
            setMessages([initMessage]);
            setHistoryLoaded(true);
          });
      } else {
        setMessages([initMessage]);
        setHistoryLoaded(true);
      }
    }
  }, [currentAnalysis]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Only scroll the internal messages container smoothly, do NOT scroll the whole window!
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isTyping]);

  const handleSendQuestion = async (qText?: string) => {
    const question = qText || inputQuestion.trim();
    if (!question) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuestion("");
    setIsTyping(true);

    try {
      const sessionId = currentAnalysis?.job_id || null;
      let data = await apiClient.sendChatMessage(question, sessionId).catch(async (err: any) => {
        // Auto-reindex if server restarted and lost the vector store
        const isGone =
          err?.status === 404 ||
          (err?.data?.detail || err?.message || "").toLowerCase().includes("no transcript");

        if (isGone && currentAnalysis) {
          const reindexMsg: Message = {
            id: Date.now().toString() + "-reindex",
            sender: "assistant",
            text: "⚡ Server restarted and lost the index. Re-indexing your content now — this takes about 10–30 seconds...",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, reindexMsg]);

          // Re-analyze the source to rebuild the vector store
          const source = currentAnalysis.metadata?.source || "";
          if (source) {
            await apiClient.analyzeVideoAsync(source);
          }

          // Retry the question with the fresh session
          return await apiClient.sendChatMessage(question, sessionId);
        }
        throw err;
      });
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: data.answer || "No response received.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
      
    } catch (error: any) {
      console.error('=== InteractiveChat: Request ERROR ===', error);
      setIsTyping(false);

      // Surface the real error message from the backend instead of a generic one
      const detail =
        error?.data?.detail ||
        error?.message ||
        "Unknown error";

      const isSessionGone =
        error?.status === 404 ||
        detail.toLowerCase().includes("no transcript") ||
        detail.toLowerCase().includes("session") ||
        detail.toLowerCase().includes("restarted");

      const errorText = isSessionGone
        ? `Session expired — the server restarted and lost the in-memory index. Please re-analyze the video or document and then ask again.\n\n_Technical detail: ${detail}_`
        : `Failed to get an answer: ${detail}`;

      const errorAiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: errorText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorAiMsg]);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentQuestions = isPdf ? PRESET_PDF_QUESTIONS : PRESET_VIDEO_QUESTIONS;

  return (
    <section id="chat" className="py-8 sm:py-16 px-3 sm:px-6 bg-[#FDFCF0] border-t border-[#1A1A1A]/10">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 rounded-full bg-[#D9CCF5]/60 text-[#1A1A1A] text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-2">
            <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Interactive Vector RAG Chat
          </div>
          <h2 className="font-['Baskervville',serif] text-2xl sm:text-3xl md:text-4xl text-[#1A1A1A]">
            Ask Anything About <span className="text-[#8A8A8A]">{isPdf ? "The Document" : "The Media"}</span>
          </h2>
        </div>

        {/* Chat Window Container */}
        <div className="rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] bg-white shadow-xl overflow-hidden flex flex-col h-[480px] sm:h-[540px] md:h-[600px]">
          {/* Top Chat Bar */}
          <div className="p-3 sm:p-4 bg-[#FDFCF0] border-b border-[#1A1A1A]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#1A1A1A] text-[#D9CCF5] flex items-center justify-center font-bold shrink-0">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-[#1A1A1A]">AI Assistant</h4>
                <p className="text-[10px] text-[#8A8A8A] truncate">
                  Vector RAG Engine • Sub-10ms Semantic Search
                  {historyLoaded && messages.length > 2 && (
                    <span className="ml-1 text-[#D9CCF5]">
                      • <History className="w-2.5 h-2.5 inline" /> History loaded
                    </span>
                  )}
                </p>
              </div>
            </div>
            {currentAnalysis && (
              <span className="text-[10px] sm:text-[11px] font-mono text-[#1A1A1A]/80 bg-[#D9CCF5]/40 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-[#D9CCF5] truncate max-w-full sm:max-w-xs self-start sm:self-auto">
                Context: {currentAnalysis.title?.length > 25 ? currentAnalysis.title.substring(0, 25) + "..." : currentAnalysis.title || "Document"}
              </span>
            )}
          </div>

          {/* Preset Chips */}
          <div className="p-2.5 sm:p-3 bg-[#FDFCF0]/40 border-b border-[#1A1A1A]/5 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#8A8A8A] shrink-0 pl-1">
              Suggestions:
            </span>
            {currentQuestions.map((pq, idx) => (
              <button
                key={idx}
                onClick={() => handleSendQuestion(pq)}
                disabled={isTyping}
                className="px-2.5 sm:px-3 py-1 rounded-xl border border-[#1A1A1A]/15 bg-white text-[11px] sm:text-xs font-medium text-[#1A1A1A] hover:bg-[#D9CCF5]/40 transition-colors shrink-0 whitespace-nowrap active:scale-95"
              >
                {pq}
              </button>
            ))}
          </div>

          {/* Messages Body */}
          <div ref={messagesContainerRef} className="flex-1 p-3.5 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-4 bg-[#FDFCF0]/20">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 sm:gap-3 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.sender === "assistant" && (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#1A1A1A] text-[#D9CCF5] flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-xl p-3 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed relative group break-words overflow-x-auto ${
                    m.sender === "user"
                      ? "bg-[#1A1A1A] text-white rounded-br-none shadow-xs [&_strong]:text-[#D9CCF5] [&_em]:text-[#D9CCF5]/90 [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:my-0.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:my-1"
                      : "bg-white border border-[#1A1A1A]/15 text-[#1A1A1A] rounded-bl-none shadow-xs [&_strong]:text-[#1A1A1A] [&_strong]:font-bold [&_em]:text-[#8A8A8A] [&_code]:bg-[#FDFCF0] [&_code]:px-1 [&_code]:rounded [&_code]:border [&_code]:border-[#1A1A1A]/10 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:my-0.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:my-1"
                  }`}
                >
                  <div className="markdown-content overflow-x-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-current/10 pt-1.5 text-[9px] sm:text-[10px] opacity-70">
                    <span>{m.timestamp}</span>
                    <button
                      onClick={() => handleCopyMessage(m.id, m.text)}
                      className="hover:opacity-100 transition-opacity p-0.5"
                      title="Copy response"
                    >
                      {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                {m.sender === "user" && (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#D9CCF5] text-[#1A1A1A] flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-[#8A8A8A] font-medium p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1A1A1A]" />
                <span>AI is searching vector context...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuestion();
            }}
            className="p-2 sm:p-3 bg-white border-t border-[#1A1A1A]/10 flex items-center gap-1.5 sm:gap-2"
          >
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder={`Ask a question about the ${isPdf ? "PDF document" : "media transcript"}...`}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-[#1A1A1A]/15 bg-[#FDFCF0]/50 text-xs sm:text-sm text-[#1A1A1A] placeholder-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-[#D9CCF5]"
            />
            <button
              type="submit"
              disabled={!inputQuestion.trim() || isTyping}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#1A1A1A] text-white font-semibold text-xs hover:bg-black transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 shrink-0 active:scale-95"
            >
              <span>Send</span>
              <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#D9CCF5]" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
