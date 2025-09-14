"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { PenBoxIcon } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface ConversationTurn {
  question: string
  answer: string
  isLoading: boolean
}

export default function MeanGPTPage() {
  const [question, setQuestion] = useState("")
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSingleLineCentered, setIsSingleLineCentered] = useState(true)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [breathingMessageIndex, setBreathingMessageIndex] = useState(0)

  const initialTextareaRef = useRef<HTMLTextAreaElement>(null)
  const responseTextareaRef = useRef<HTMLTextAreaElement>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)

  const breathingMessages = [
    "MeanGPT on the move...",
    "MeanGPT tracking down the AIs...",
    "MeanGPT is after them...",
    "Gathering wisdom from the digital minds...",
    "Almost there, connecting the dots...",
    "Processing responses from all corners...",
    "Weaving together the perfect answer..."
  ]

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement, setExpanded: (expanded: boolean) => void) => {
    const text = textarea.value
    const lineHeight = 24
    const maxHeight = lineHeight * 6
    
    if (!text.trim()) {
      // Empty - stay compact
      setIsSingleLineCentered(true)
      setExpanded(false)
      textarea.style.height = ""  // Use CSS default
      textarea.style.overflowY = "hidden"
      return
    }

    // Check if we need to measure
    const hasLineBreaks = text.includes('\n')
    const isProbablyLong = text.length > 70 || hasLineBreaks
    
    if (isProbablyLong) {
      // Save current state to minimize visual change
      const currentHeight = textarea.style.height
      
      // Measure actual content height
      textarea.style.height = "26px" // Start from compact height
      const singleLineScrollHeight = textarea.scrollHeight
      
      // Now check if content actually exceeds single line
      if (singleLineScrollHeight > 30) { // Content needs more than one line
        if (isSingleLineCentered) {
          setIsSingleLineCentered(false)
          setExpanded(true)
        }
        
        // Set to actual needed height
        textarea.style.height = "auto"
        const fullScrollHeight = textarea.scrollHeight
        
        if (fullScrollHeight > maxHeight) {
          textarea.style.height = `${maxHeight}px`
          textarea.style.overflowY = "auto"
        } else {
          textarea.style.height = `${fullScrollHeight}px`
          textarea.style.overflowY = "hidden"
        }
      } else {
        // Content fits in single line
        if (!isSingleLineCentered) {
          setIsSingleLineCentered(true)
          setExpanded(false)
        }
        textarea.style.height = ""
        textarea.style.overflowY = "hidden"
      }
    } else {
      // Short text - definitely single line
      if (!isSingleLineCentered) {
        setIsSingleLineCentered(true)
        setExpanded(false)
      }
      textarea.style.height = ""
      textarea.style.overflowY = "hidden"
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value)
    adjustTextareaHeight(e.target, setIsExpanded)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (question.trim() && !isProcessing) {
        handleSubmit(e as any)
      }
    }
  }

  const scrollToBottom = () => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (conversationHistory.length > 0) {
      scrollToBottom()
    }
  }, [conversationHistory])

  // Auto-focus input after response loads
  useEffect(() => {
    if (!isProcessing && conversationHistory.length > 0) {
      // Focus the appropriate textarea based on current screen
      const targetTextarea = conversationHistory.length > 0 ? responseTextareaRef.current : initialTextareaRef.current
      if (targetTextarea) {
        targetTextarea.focus()
      }
    }
  }, [isProcessing, conversationHistory.length])

  // Global keydown listener for auto-focus when typing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't interfere if user is already in an input/textarea or pressing special keys
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement ||
          e.ctrlKey || e.metaKey || e.altKey ||
          e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter') {
        return
      }
      
      // If user starts typing, focus the appropriate textarea
      if (e.key.length === 1) { // Regular character keys
        const targetTextarea = conversationHistory.length > 0 ? responseTextareaRef.current : initialTextareaRef.current
        if (targetTextarea) {
          targetTextarea.focus()
          // Don't prevent default - let the character be typed
        }
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [conversationHistory.length])

  // Breathing animation message rotation
  useEffect(() => {
    if (!isProcessing) {
      setBreathingMessageIndex(0)
      return
    }

    const interval = setInterval(() => {
      setBreathingMessageIndex(prev => (prev + 1) % breathingMessages.length)
    }, 3500) // 3.5 seconds

    return () => clearInterval(interval)
  }, [isProcessing, breathingMessages.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    // Store question before clearing
    const currentQuestion = question
    
    // Clear input immediately
    setQuestion("")
    setIsExpanded(false)
    setIsSingleLineCentered(true)

    // Create loading state
    const newTurn: ConversationTurn = {
      question: currentQuestion,
      answer: "",
      isLoading: true,
    }

    setConversationHistory((prev) => [...prev, newTurn])
    setIsProcessing(true)

    try {
      // Call our real backend API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentQuestion,
          conversationId: currentConversationId,
        }),
      })

      const result = await response.json()

      if (result.success && result.data) {
        // Store conversationId for future messages
        if (result.data.conversationId && !currentConversationId) {
          setCurrentConversationId(result.data.conversationId)
        }
        
        // Format the response with markdown
        let formattedAnswer = ""
        
        if (result.data.aggregatedData && result.data.aggregatedData.meanAnswer) {
          // Use the already formatted meanAnswer from the backend
          formattedAnswer = result.data.aggregatedData.meanAnswer
        } else {
          // Direct response formatting
          formattedAnswer = `**Answer:** ${result.data.response}`
        }

        // Update the conversation with formatted response
        setConversationHistory((prev) => {
          const updated = [...prev]
          const lastTurnIndex = updated.length - 1
          updated[lastTurnIndex].answer = formattedAnswer
          updated[lastTurnIndex].isLoading = false
          return updated
        })
      } else {
        // Handle error case
        setConversationHistory((prev) => {
          const updated = [...prev]
          const lastTurnIndex = updated.length - 1
          updated[lastTurnIndex].answer = `## Error\n\n${result.error || 'Failed to get response'}`
          updated[lastTurnIndex].isLoading = false
          return updated
        })
      }
    } catch (error) {
      // Handle network/fetch errors
      setConversationHistory((prev) => {
        const updated = [...prev]
        const lastTurnIndex = updated.length - 1
        updated[lastTurnIndex].answer = `## Network Error\n\n${error instanceof Error ? error.message : 'Failed to connect'}`
        updated[lastTurnIndex].isLoading = false
        return updated
      })
    } finally {
      setIsProcessing(false)
      // Auto-focus input after processing completes
      setTimeout(() => {
        const targetTextarea = conversationHistory.length > 0 ? responseTextareaRef.current : initialTextareaRef.current
        if (targetTextarea) {
          targetTextarea.focus()
        }
      }, 100)
    }
  }

  const handleNewChat = () => {
    setConversationHistory([])
    setIsProcessing(false)
    setQuestion("")
    setIsExpanded(false)
    setIsSingleLineCentered(true)
    setCurrentConversationId(null) // Reset conversation
  }

  const hasResponses = conversationHistory.length > 0

  return (
    <>
      <style jsx>{`
        @keyframes breathe {
          0%, 100% { 
            opacity: 0.7;
            transform: scale(1);
          }
          50% { 
            opacity: 1;
            transform: scale(1.02);
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <header className="fixed top-0 left-0 p-6 z-50">
        <button
          onClick={handleNewChat}
          className="bg-accent hover:bg-accent/90 border-accent rounded-full h-10 w-10 shadow-lg flex items-center justify-center"
        >
          <PenBoxIcon className="stroke-3 h-8 w-[22px] text-[rgba(52,54,56,1)]" />
        </button>
      </header>

      <main className="flex-1 flex flex-col">
        {!hasResponses ? (
          <div className="flex-1 flex flex-col items-center px-4 max-w-4xl mx-auto w-full pt-20">
            <div className="h-24"></div>

            <div className="text-center mb-16 space-y-8">
              <h1 className="font-bold text-balance text-7xl">
                Me<span className="text-accent">an</span>GPT
              </h1>

              <div className="text-sm text-muted-foreground italic leading-relaxed max-w-2xl -mt-4 mb-8">
                <p className="text-sm">One GPT to rule them all, One GPT to find them,</p>
                <p className="text-sm">One GPT to bring them all, and in the chatbox bind them</p>
              </div>

              <div className="text-base text-muted-foreground leading-relaxed max-w-2xl space-y-2">
                <p className="text-lg">
                  <span className="text-accent">MeanGPT</span> is a tool that asks your questions to all{" "}
                  <span className="text-accent">the best AI</span> softwares, summarises each answer, shows them to you,
                  and finally gives the <span className="text-accent">final verdict</span> based on these answers.
                </p>
              </div>

              <div className="flex justify-center">
                <img
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/MeanGPT_Logo%2001-qYbU7nzpJoYRZvGEX9RTZludCEaUKC.png"
                  alt="MeanGPT Logo"
                  className="h-20 object-contain w-[57px]"
                />
              </div>

              <div className="w-full max-w-2xl px-4">
                <form onSubmit={handleSubmit} className="relative">
                  <div
                    className={`relative bg-card/80 backdrop-blur-sm shadow-2xl border border-border/50 p-2 shadow-lg transition-all duration-300 rounded-3xl ${isExpanded ? "rounded-lg" : ""}`}
                  >
                    <div
                      className={`transition-all duration-300 ${isSingleLineCentered ? "pt-2 pb-2" : "pr-4 pb-8 pt-2"}`}
                    >
                      <textarea
                        ref={initialTextareaRef}
                        value={question}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none focus:border-transparent text-base px-4 placeholder:text-muted-foreground/60 shadow-none leading-6 font-bold disabled:opacity-100 resize-none transition-all duration-300 ${
                          isSingleLineCentered ? "py-1 min-h-[26px] pl-4 pr-16" : "py-1 min-h-[26px] pl-4 pr-16"
                        }`}
                        style={{
                          scrollbarWidth: "thin",
                          scrollbarColor: "#AFAB9E transparent",
                        }}
                        placeholder="Ask and you shall receive..."
                        rows={1}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!question.trim() || isProcessing}
                      className={`absolute h-10 w-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
                        isSingleLineCentered ? "right-2 top-1/2 -translate-y-1/2" : "right-2 bottom-2"
                      } ${isProcessing ? 'cursor-not-allowed' : (!question.trim() ? 'cursor-not-allowed' : 'hover:opacity-90')}`}
                      style={{ 
                        backgroundColor: isProcessing ? "#A0A0A0" : "#E7CB6F",
                        opacity: isProcessing ? 0.5 : 1
                      }}
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg
                          width="23"
                          height="23"
                          viewBox="0 0 12 12"
                          fill="none"
                          style={{ transform: "translateX(1px)" }}
                        >
                          <path d="M2 2L10 6L2 10V2Z" fill="#343638" />
                        </svg>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto pb-40">
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-8 min-h-full">
              {conversationHistory.map((turn, turnIndex) => (
                <div key={turnIndex} className="space-y-6">
                  {/* User Question */}
                  <div className="flex justify-end">
                    <div className="bg-card/80 backdrop-blur-sm rounded-3xl px-4 py-3 border border-border/50 max-w-2xl">
                      <p className="font-medium text-right text-base">{turn.question}</p>
                    </div>
                  </div>

                  {/* MeanGPT Response */}
                  <div className="bg-card/40 backdrop-blur-sm rounded-3xl px-6 py-4 border border-border/30 w-full">
                    {turn.isLoading ? (
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex gap-1">
                          <div className="w-3 h-3 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                          <div className="w-3 h-3 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                          <div className="w-3 h-3 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                        </div>
                        <div className="relative">
                          <span 
                            key={breathingMessageIndex}
                            className="text-base font-medium text-foreground transition-all duration-500"
                            style={{
                              animation: 'breathe 3.5s ease-in-out infinite, fadeIn 0.5s ease-in',
                            }}
                          >
                            {breathingMessages[breathingMessageIndex]}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-invert prose-lg max-w-none text-foreground leading-relaxed w-full overflow-visible">
                        <ReactMarkdown 
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeRaw, rehypeKatex]}
                          components={{
                            h1: ({children}) => <h1 className="text-2xl font-bold text-foreground mb-4">{children}</h1>,
                            h2: ({children}) => <h2 className="text-xl font-semibold text-foreground mb-3 mt-6">{children}</h2>,
                            h3: ({children}) => <h3 className="text-lg font-medium text-foreground mb-2 mt-4">{children}</h3>,
                            p: ({children}) => <p className="text-foreground mb-4 leading-relaxed">{children}</p>,
                            ul: ({children}) => <ul className="list-disc list-inside mb-4 space-y-1 text-foreground">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal list-inside mb-4 space-y-1 text-foreground">{children}</ol>,
                            li: ({children}) => <li className="text-foreground">{children}</li>,
                            hr: () => <hr className="my-6 border-t border-accent/30" />,
                            img: ({src, alt}) => {
                              // Check if this is an AI logo
                              if (src && typeof src === 'string' && src.includes('AILogos')) {
                                return (
                                  <img 
                                    src={src} 
                                    alt={alt} 
                                    className="inline-block w-6 h-6 mr-2 align-middle rounded"
                                    style={{ verticalAlign: 'middle' }}
                                  />
                                );
                              }
                              // Default image styling for other images
                              return <img src={src} alt={alt} className="max-w-full h-auto rounded" />;
                            },
                            blockquote: ({children}) => <blockquote className="border-l-4 border-foreground/30 pl-4 italic text-foreground/80 mb-4">{children}</blockquote>,
                            code: ({children}) => <code className="bg-muted px-2 py-1 rounded text-sm font-mono text-foreground">{children}</code>,
                            pre: ({children}) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 text-foreground">{children}</pre>,
                            strong: ({children}) => {
                              const text = children?.toString() || '';
                              const getProviderColor = (text: string): string => {
                                if (text.includes('OpenAI ChatGPT:')) return '#10B981'; // Emerald green
                                if (text.includes('Anthropic Claude:')) return '#d77655'; // Custom orange
                                if (text.includes('Google Gemini:')) return '#3286ff'; // Custom blue
                                if (text.includes('xAI Grok:')) return '#0e0e0e'; // Custom black
                                if (text.includes('Answer:')) return '#E7CB6F'; // Accent color for Answer
                                if (text.includes('Key Details:')) return '#E7CB6F'; // Accent color for Key Details
                                if (text.includes('Note:')) return '#E7CB6F'; // Accent color for Note
                                return '#ECE8D8'; // Default foreground color
                              };
                              const color = getProviderColor(text);
                              return <strong className="font-bold" style={{color}}>{children}</strong>;
                            },
                            em: ({children}) => <em className="italic text-foreground">{children}</em>,
                          }}
                        >
                          {turn.answer}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={conversationEndRef} />
            </div>
          </div>
        )}

        {hasResponses && (
          <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border/20 z-20">
            <div className="max-w-2xl mx-auto px-6">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <div
                  className={`relative bg-card/80 backdrop-blur-sm shadow-2xl border border-border/50 p-2 shadow-lg flex-1 transition-all duration-300 rounded-3xl ${isExpanded ? "rounded-lg" : ""}`}
                  style={{
                    marginBottom: isSingleLineCentered ? "1.5rem" : "1.5rem",
                    marginTop: isSingleLineCentered ? "1.5rem" : "0.5rem",
                  }}
                >
                  <div
                    className={`transition-all duration-300 ${isSingleLineCentered ? "pt-2 pb-2" : "pr-4 pb-8 pt-2"}`}
                  >
                    <textarea
                      ref={responseTextareaRef}
                      value={question}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none focus:border-transparent text-base px-4 placeholder:text-muted-foreground/60 shadow-none leading-6 font-bold disabled:opacity-100 resize-none transition-all duration-300 ${
                        isSingleLineCentered ? "py-1 min-h-[26px] pl-4 pr-16" : "py-1 min-h-[26px] pl-4 pr-16"
                      }`}
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#6b7280 transparent",
                      }}
                      placeholder="Ask and you shall receive..."
                      rows={1}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!question.trim() || isProcessing}
                    className={`absolute h-10 w-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
                      isSingleLineCentered ? "right-2 top-1/2 -translate-y-1/2" : "right-2 bottom-2"
                    } ${isProcessing ? 'cursor-not-allowed' : (!question.trim() ? 'cursor-not-allowed' : 'hover:opacity-90')}`}
                    style={{ 
                      backgroundColor: isProcessing ? "#A0A0A0" : "#E7CB6F",
                      opacity: isProcessing ? 0.5 : 1
                    }}
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg
                        width="23"
                        height="23"
                        viewBox="0 0 12 12"
                        fill="none"
                        style={{ transform: "translateX(1px)" }}
                      >
                        <path d="M2 2L10 6L2 10V2Z" fill="#343638" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"></div>
      </div>
    </>
  )
}