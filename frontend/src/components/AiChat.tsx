import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Trash2, ChevronDown } from "lucide-react";
import { aiApi } from "@/api/endpoints";
import { apiError } from "@/api/client";
import { Spinner } from "@/components/Spinner";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "model";
  text: string;
}

const HISTORY_WINDOW = 20;

export function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  
  const send = async () => {
    const text = input.trim();
    if (!text || loading) {
      return;
    }
    const userMsg: Message = { role: "user", text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      
      const history = newMessages
        .slice(0, -1)
        .slice(-HISTORY_WINDOW)
        .map(m => {
          return { role: m.role, parts: [{ text: m.text }] };
        });
      const { reply } = await aiApi.chat(text, history);
      setMessages(prev => {
        return [...prev, { role: "model", text: reply }];
      });
    } catch (e) {
      setError(apiError(e, "Failed to get AI response"));
    } finally {
      setLoading(false);
    }
  };

  
  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <>
      <button
        onClick={() => {
          return setOpen(p => {
            return !p;
          });
        }}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 active:scale-95"
        style={{
          background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
          boxShadow: "0 4px 20px rgba(124,58,237,0.5)",
        }}
        title="Ask AI"
      >
        {open ? (
          <ChevronDown className="w-6 h-6 text-white" />
        ) : (
          <Bot className="w-6 h-6 text-white" />
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-36 right-4 md:bottom-24 md:right-6 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: "min(360px, calc(100vw - 32px))",
            height: "min(520px, calc(100vh - 180px))",
            background: "#0b141a",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          }}
        >
          {}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{
              background: "linear-gradient(135deg, #1a103a, #14103a)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            >
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm" style={{ color: "#e9edef" }}>
                AI Assistant
              </div>
              <div className="text-[11px]" style={{ color: "#8696a0" }}>
                Powered by Gemini
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-full hover:bg-white/10 transition"
                  style={{ color: "#8696a0" }}
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  return setOpen(false);
                }}
                className="p-1.5 rounded-full hover:bg-white/10 transition"
                style={{ color: "#8696a0" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {}
          <div
            className="flex-1 overflow-y-auto p-3 space-y-2"
            style={{ overscrollBehavior: "contain" }}
          >
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.3)",
                  }}
                >
                  <Bot className="w-7 h-7" style={{ color: "#7c3aed" }} />
                </div>
                <div>
                  <div className="font-medium text-sm" style={{ color: "#e9edef" }}>
                    Ask me anything
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#8696a0" }}>
                    I'm your AI assistant. Start a conversation!
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              return (
                <div
                  key={i}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "model" && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mr-1.5 mt-0.5"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                    >
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div
                    className="max-w-[82%] px-3 py-2 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap break-words"
                    style={{
                      background: m.role === "user" ? "#4f46e5" : "#1f2c34",
                      color: "#e9edef",
                      borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mr-1.5 mt-0.5"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                >
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div
                  className="px-4 py-3 rounded-2xl flex gap-1 items-center"
                  style={{ background: "#1f2c34", borderRadius: "18px 18px 18px 4px" }}
                >
                  {[0, 150, 300].map(delay => {
                    return (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{
                          background: "#8696a0",
                          animationDelay: `${delay}ms`,
                          animationDuration: "1.2s",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div
                className="text-xs text-center px-3 py-2 rounded-xl"
                style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}
              >
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {}
          <div
            className="flex items-center gap-2 px-3 py-2.5 shrink-0"
            style={{ background: "#0b141a", borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="flex-1 flex items-center px-3 py-2 rounded-full"
              style={{ background: "#1f2c34", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => {
                  return setInput(e.target.value);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Message AI..."
                className="flex-1 bg-transparent text-[14px] outline-none placeholder-[#8696a0]"
                style={{ color: "#e9edef" }}
                disabled={loading}
              />
            </div>
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            >
              {loading ? (
                <Spinner className="w-4 h-4 text-white" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
