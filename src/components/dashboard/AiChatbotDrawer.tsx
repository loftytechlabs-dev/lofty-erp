import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BusinessAiContext,
  askAiCopilot,
  getStoredGeminiApiKey,
  saveStoredGeminiApiKey,
} from '../../services/aiService';
import { createPurchaseOrder } from '../../services/purchaseOrderService';
import { PurchaseOrder } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../common/Button';
import {
  Sparkles,
  X,
  Send,
  Key,
  Settings,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShoppingCart,
  Bot,
  User,
  ArrowRight,
  Package,
  Building,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  actionExecuted?: string;
  createdPo?: PurchaseOrder;
  source?: 'gemini' | 'local_copilot';
  timestamp: string;
}

interface AiChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: BusinessAiContext;
  onExecuteAction: (action: any) => void;
}

export const AiChatbotDrawer: React.FC<AiChatbotDrawerProps> = ({
  isOpen,
  onClose,
  context,
  onExecuteAction,
}) => {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: `Hello! I'm your **Lofty AI Operations Assistant** for **${context.businessName}**.\n\nYou can chat with me, ask questions about your suppliers and inventory, or instruct me directly: \n\n👉 *"Order 50 Copper Wire from K-Tech to Peenya warehouse"*\n\nI will automatically create the purchase order, calculate GST, and record it in your database!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getStoredGeminiApiKey());
  const [hasSavedKeyNotice, setHasSavedKeyNotice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSaveApiKey = () => {
    saveStoredGeminiApiKey(apiKeyInput);
    setHasSavedKeyNotice(true);
    setTimeout(() => {
      setHasSavedKeyNotice(false);
      setShowSettings(false);
    }, 1500);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const response = await askAiCopilot(promptToSend, context);

      let actionDesc: string | undefined = undefined;
      let newlyCreatedPo: PurchaseOrder | undefined = undefined;

      // Handle Direct Purchase Order Action
      if (response.action && response.action.type === 'CREATE_PO' && response.action.poOrder) {
        const ord = response.action.poOrder;
        const bId = context.businessId || 'biz_voltcraft_karnataka';

        try {
          newlyCreatedPo = await createPurchaseOrder(
            bId,
            context.businessName,
            {
              vendorId: ord.vendor.id,
              vendorName: ord.vendor.name,
              vendorGstin: ord.vendor.gstin,
              vendorEmail: ord.vendor.email,
              warehouseId: ord.warehouse.id,
              warehouseName: ord.warehouse.name,
              items: [
                {
                  productId: ord.product.id,
                  productName: ord.product.name,
                  sku: ord.product.sku,
                  unit: ord.product.unit || 'Units',
                  quantity: ord.quantity,
                  receivedQuantity: 0,
                  unitPrice: ord.unitPrice,
                  lineTotal: ord.lineTotal,
                  taxRate: ord.taxRate,
                  taxAmount: ord.taxAmount,
                  totalWithTax: ord.totalWithTax,
                },
              ],
              expectedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
              notes: `Automated Purchase Order generated via Lofty AI Assistant upon chat command: "${promptToSend}"`,
              createdBy: 'Lofty AI Assistant',
            }
          );

          onExecuteAction({ type: 'PO_CREATED', po: newlyCreatedPo });
          actionDesc = `Created & Dispatched Purchase Order ${newlyCreatedPo.orderNumber}`;
        } catch (poErr: any) {
          console.error('Failed to auto-create purchase order:', poErr);
        }
      } else if (response.action) {
        onExecuteAction(response.action);
        if (response.action.type === 'OPEN_PPT') {
          actionDesc = 'Opened Operations Deck Studio';
        }
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        actionExecuted: actionDesc,
        createdPo: newlyCreatedPo,
        source: response.source,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'assistant',
          text: `An error occurred: ${err.message || 'Unable to process request'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'msg-welcome-new',
        sender: 'assistant',
        text: `Chat history cleared. How can I assist your operations today? You can instruct me to order items or ask for operational analytics.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  if (!isOpen) return null;

  const currentApiKey = getStoredGeminiApiKey();
  const isCloudModelActive = Boolean(currentApiKey);

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-slide-left font-sans">
      {/* 1. Header */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center space-x-2">
              <span>Lofty AI Copilot</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                isCloudModelActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{isCloudModelActive ? 'Gemini 3.5 Flash Lite' : 'Local Engine'}</span>
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Autonomous Operations &amp; Order Dispatcher
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-colors ${
              showSettings ? 'text-orange-400 bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="API Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Optional Settings Drawer */}
      {showSettings && (
        <div className="p-4 bg-orange-50/60 border-b border-orange-200 text-xs space-y-3 animate-fade-in shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center space-x-1.5">
              <Key className="w-4 h-4 text-orange-600" />
              <span>Gemini API Key Settings</span>
            </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-brand-600 hover:underline flex items-center space-x-0.5"
            >
              <span>Get Free Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-[11px] text-slate-600 leading-normal">
            Your key connects to <strong>Gemini 3.5 Flash Lite</strong>. If unset or throttled, Lofty switches to the offline local ERP heuristic engine.
          </p>

          <div className="flex items-center space-x-2">
            <input
              type="password"
              placeholder="Paste AI Studio API key here..."
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-brand-500 font-mono"
            />
            <Button variant="primary" size="sm" onClick={handleSaveApiKey}>
              Save
            </Button>
          </div>

          {hasSavedKeyNotice && (
            <div className="text-[11px] font-semibold text-emerald-600 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>API Key saved securely in browser!</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
        {messages.map(msg => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 px-1">
                {isUser ? (
                  <>
                    <span>You</span>
                    <span>&bull;</span>
                    <span>{msg.timestamp}</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-orange-600" />
                    <span className="font-semibold text-slate-600">Lofty AI</span>
                    <span>&bull;</span>
                    <span>{msg.timestamp}</span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-orange-600 text-white rounded-br-xs shadow-xs'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs shadow-xs'
                }`}
              >
                {/* Markdown Formatting */}
                <div className="whitespace-pre-wrap space-y-1">
                  {msg.text.split('\n\n').map((para, i) => (
                    <p key={i}>
                      {para.split('**').map((seg, segIdx) =>
                        segIdx % 2 === 1 ? (
                          <strong key={segIdx} className={isUser ? 'font-bold underline' : 'font-bold text-slate-900'}>
                            {seg}
                          </strong>
                        ) : (
                          seg
                        )
                      )}
                    </p>
                  ))}
                </div>

                {/* Executed Action Pill */}
                {msg.actionExecuted && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center space-x-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>⚡ {msg.actionExecuted}</span>
                  </div>
                )}

                {/* Render Rich Purchase Order Card if PO was created */}
                {msg.createdPo && (
                  <div className="mt-2.5 p-3 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl shadow-xs space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>PO Created &amp; Dispatched!</span>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                        {msg.createdPo.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-700 space-y-1 pt-1 border-t border-emerald-200/60 font-sans">
                      <div className="flex justify-between">
                        <span className="text-slate-500">PO Number:</span>
                        <span className="font-bold text-slate-900 font-mono">{msg.createdPo.orderNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Supplier:</span>
                        <span className="font-semibold text-slate-800">{msg.createdPo.vendorName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Destination:</span>
                        <span className="text-slate-700">{msg.createdPo.warehouseName}</span>
                      </div>
                      {msg.createdPo.items[0] && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Line Item:</span>
                          <span className="font-medium text-slate-800">
                            {msg.createdPo.items[0].quantity} x {msg.createdPo.items[0].productName}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-emerald-200/40">
                        <span className="text-slate-600 font-semibold">Total (incl. GST):</span>
                        <span className="font-bold text-emerald-700">
                          {formatCurrency(msg.createdPo.grandTotal, context.currencySymbol)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/purchases/${msg.createdPo!.id}`);
                      }}
                      className="w-full mt-2 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <span>View PO #{msg.createdPo.orderNumber}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs max-w-[220px] animate-pulse">
            <Sparkles className="w-4 h-4 text-orange-500 animate-spin" />
            <span>Processing your order instruction…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Quick Suggested Prompt Chips */}
      <div className="p-2.5 bg-white border-t border-slate-100 overflow-x-auto flex items-center space-x-1.5 shrink-0 no-scrollbar">
        <button
          type="button"
          onClick={() => handleSendMessage('Order 50 Copper Wire from K-Tech to Peenya Godown')}
          className="whitespace-nowrap px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-900 rounded-full text-[11px] font-semibold border border-orange-300 transition-colors flex items-center space-x-1 cursor-pointer"
        >
          <ShoppingCart className="w-3 h-3 text-orange-700" />
          <span>Order 50 Copper Wire</span>
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage('Order 30 CRGO Steel from Deccan to Bommasandra')}
          className="whitespace-nowrap px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-900 rounded-full text-[11px] font-semibold border border-orange-300 transition-colors flex items-center space-x-1 cursor-pointer"
        >
          <ShoppingCart className="w-3 h-3 text-orange-700" />
          <span>Order 30 CRGO Steel</span>
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage('Order 25 Brass Terminals from Bangalore Precision to Peenya')}
          className="whitespace-nowrap px-2.5 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-900 text-slate-700 rounded-full text-[11px] font-medium border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
        >
          <Package className="w-3 h-3 text-slate-500" />
          <span>Order 25 Brass Terminals</span>
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage('Which items have low stock or need reordering?')}
          className="whitespace-nowrap px-2.5 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-900 text-slate-700 rounded-full text-[11px] font-medium border border-slate-200 transition-colors cursor-pointer"
        >
          ⚠️ Low Stock Alerts
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage('How much spend do we have with suppliers?')}
          className="whitespace-nowrap px-2.5 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-900 text-slate-700 rounded-full text-[11px] font-medium border border-slate-200 transition-colors cursor-pointer"
        >
          💰 Spend Breakdown
        </button>
      </div>

      {/* 5. Input Field */}
      <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="e.g. 'Order 50 Copper Wire from K-Tech to Peenya Godown'..."
          className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-brand-500 transition-all font-sans"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleSendMessage()}
          disabled={!input.trim() || isThinking}
          className="p-2 h-9 w-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
