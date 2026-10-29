import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  askAiCopilot,
  detectAndParsePoOrder,
  verifyBillAuthenticityWithGemini,
  getStoredGeminiApiKey,
  saveStoredGeminiApiKey,
  BusinessAiContext,
} from '../../services/aiService';
import { createPurchaseOrder, getPurchaseOrders } from '../../services/purchaseOrderService';
import { getProducts, getWarehouses } from '../../services/productService';
import { getVendors, getVendorProducts } from '../../services/vendorService';
import { getStockBalances } from '../../services/stockService';
import { getDeliveries } from '../../services/deliveryService';
import { getSupplierBills } from '../../services/billService';
import {
  PurchaseOrder,
  Product,
  Vendor,
  Warehouse,
  StockBalance,
  Delivery,
  SupplierBill,
  BillAiVerification,
} from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Paperclip,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  Package,
  Receipt,
  Truck,
  ArrowRight,
  ExternalLink,
  Bot,
  User,
  ShieldCheck,
  ShieldAlert,
  Boxes,
  RotateCcw,
  Minimize2,
  Maximize2,
  Layers,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  createdPo?: PurchaseOrder;
  stockView?: { warehouseName: string; items: StockBalance[] };
  billsView?: SupplierBill[];
  deliveriesView?: Delivery[];
  aiBillVerification?: BillAiVerification;
  attachedImage?: string;
  source?: 'gemini' | 'local_copilot' | 'autonomous_agent';
  timestamp: string;
}

interface OmnipotentAiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Clean Rich-Text / Markdown Formatter: renders bold, bullets, and eliminates raw asterisks ("stars")
const renderFormattedAiText = (rawText: string, isUser: boolean) => {
  if (!rawText) return null;

  const lines = rawText.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lIdx} className="h-1.5" />;
        }

        // Detect bullet lines (starts with •, -, or *)
        const isBullet = /^[•\-\*]\s+/.test(trimmed);
        const textContent = isBullet ? trimmed.replace(/^[•\-\*]\s+/, '') : trimmed;

        // Parse bold segments (**bold**)
        const segments = textContent.split('**');
        const renderedContent = segments.map((seg, sIdx) => {
          if (sIdx % 2 === 1) {
            return (
              <strong
                key={sIdx}
                className={isUser ? 'font-bold text-white underline decoration-slate-400' : 'font-bold text-slate-900'}
              >
                {seg}
              </strong>
            );
          }
          // Remove stray asterisks, markdown characters, and outer quotes
          const cleaned = seg.replace(/\*/g, '').replace(/^["']|["']$/g, '');
          return <span key={sIdx}>{cleaned}</span>;
        });

        if (isBullet) {
          return (
            <div key={lIdx} className="flex items-start space-x-2 pl-0.5">
              <span className={`text-[11px] leading-tight select-none mt-0.5 ${isUser ? 'text-slate-300' : 'text-brand-600 font-bold'}`}>
                •
              </span>
              <span className="flex-1 leading-relaxed">{renderedContent}</span>
            </div>
          );
        }

        return (
          <p key={lIdx} className="leading-relaxed">
            {renderedContent}
          </p>
        );
      })}
    </div>
  );
};

export const OmnipotentAiModal: React.FC<OmnipotentAiModalProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const { activeBusiness } = useBusiness();
  const currency = activeBusiness?.currency || '₹';
  const { user } = useAuth();

  // ERP Datasets
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [vendorProducts, setVendorProducts] = useState<any[]>([]);

  // Window State
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: `Hello! I am your **Lofty AI Operations Assistant** for **${activeBusiness?.name || 'VoltCraft Electrical Components Ltd'}**.\n\nI can execute operational workflows directly across your ERP:\n• **Order 50 items of copper wire** from K-Tech to Peenya warehouse\n• **Check stock levels** in Peenya and Bommasandra godowns\n• **Show unpaid supplier bills** and tax liabilities\n• **Check inbound deliveries** and dock queue\n• **Audit invoices** by attaching a delivery photo\n\nHow may I assist your business today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load latest datasets from MySQL
  const loadErpData = async () => {
    if (!activeBusiness) return;
    const bId = activeBusiness.id;
    try {
      const [prods, vends, whs, bals, pos, dels, sBills, vp] = await Promise.all([
        getProducts(bId),
        getVendors(bId),
        getWarehouses(bId),
        getStockBalances(bId),
        getPurchaseOrders(bId),
        getDeliveries(bId),
        getSupplierBills(bId),
        getVendorProducts(bId).catch(() => []),
      ]);
      setProducts(prods);
      setVendors(vends);
      setWarehouses(whs);
      setStockBalances(bals);
      setPurchaseOrders(pos);
      setDeliveries(dels);
      setBills(sBills);
      setVendorProducts(vp);
    } catch (err) {
      console.warn('Failed to load live ERP data for AI modal:', err);
    }
  };

  // Re-sync AI context and welcome message whenever the active business switches
  useEffect(() => {
    if (!activeBusiness) return;
    loadErpData();

    const bizName = activeBusiness.name || 'Your Business';
    setMessages([
      {
        id: `msg-welcome-${activeBusiness.id}`,
        sender: 'assistant',
        text: `Hello! I am your **Lofty AI Operations Assistant** for **${bizName}**.\n\nI can execute operational workflows directly across your ERP:\n• **Order 50 items of raw material** to your primary warehouse\n• **Check stock levels** across active godowns\n• **Show unpaid supplier bills** and tax liabilities\n• **Check inbound deliveries** and dock queue\n• **Audit invoices** by attaching a delivery photo\n\nHow may I assist your business today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInput('');
    setPendingImage(null);
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (isOpen) {
      loadErpData();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Voice speech-to-text initialization
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Image Upload for Bill Analysis
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = ev.target?.result as string;
      setPendingImage(base64);
    };
    reader.readAsDataURL(file);
  };

  // Dynamic contextual shortcuts based on active business catalogs
  const sampleProduct = products[0]?.name || 'Copper Wire';
  const sampleVendor = vendors[0]?.name || 'K-Tech';
  const sampleWarehouse = warehouses[0]?.name || 'Primary Godown';

  // Build Context for AI
  const buildContext = (): BusinessAiContext => ({
    businessName: activeBusiness?.name || 'Your Business',
    currencySymbol: typeof currency === 'string' ? currency : (currency?.symbol || '₹'),
    purchaseOrders,
    products,
    stockBalances,
    vendors,
    deliveries,
    bills,
    warehouses,
    vendorProducts,
    businessId: activeBusiness?.id,
  });

  // Autonomous Execution Handler
  const handleExecutePrompt = async (customPrompt?: string) => {
    const promptText = (customPrompt || input).trim();
    const attachedImg = pendingImage;

    if ((!promptText && !attachedImg) || isThinking) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptText || 'Uploaded document for authenticity inspection:',
      attachedImage: attachedImg || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setPendingImage(null);
    setIsThinking(true);

    const lower = promptText.toLowerCase();
    const ctx = buildContext();

    try {
      // SCENARIO 1: Image Verification Requested
      if (attachedImg) {
        const aiVerif = await verifyBillAuthenticityWithGemini(attachedImg, {
          expectedAmount: purchaseOrders[0]?.grandTotal,
          vendorName: vendors[0]?.name,
          warehouseName: warehouses[0]?.name,
        });

        setMessages(prev => [
          ...prev,
          {
            id: `ai-doc-${Date.now()}`,
            sender: 'assistant',
            text: aiVerif.isAuthentic && !aiVerif.isScamOrSuspicious
              ? `✅ **Authentic Document Verified!**\nConfidence: **${aiVerif.confidenceScore}%**\n\n${aiVerif.verdict}`
              : `🚨 **Fraud / Scam Alert!** (Risk: **${aiVerif.scamRiskLevel}**)\nConfidence: **${aiVerif.confidenceScore}%**\n\n${aiVerif.verdict}`,
            aiBillVerification: aiVerif,
            source: 'gemini',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsThinking(false);
        return;
      }

      // SCENARIO 2: Natural Language Order Booking
      // "order 50 items of copper wire from k-tech to peenya warehouse"
      const poOrder = detectAndParsePoOrder(promptText, ctx);
      if (poOrder && activeBusiness) {
        const newPo = await createPurchaseOrder(
          activeBusiness.id,
          activeBusiness.name,
          {
            vendorId: poOrder.vendor.id,
            vendorName: poOrder.vendor.name,
            vendorGstin: poOrder.vendor.gstin,
            vendorEmail: poOrder.vendor.email,
            warehouseId: poOrder.warehouse.id,
            warehouseName: poOrder.warehouse.name,
            items: [
              {
                productId: poOrder.product.id,
                productName: poOrder.product.name,
                sku: poOrder.product.sku,
                unit: poOrder.product.unit || 'Units',
                quantity: poOrder.quantity,
                receivedQuantity: 0,
                unitPrice: poOrder.unitPrice,
                lineTotal: poOrder.lineTotal,
                taxRate: poOrder.taxRate,
                taxAmount: poOrder.taxAmount,
                totalWithTax: poOrder.totalWithTax,
              },
            ],
            expectedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
            notes: `Auto-booked via Lofty AI Operations Assistant: "${promptText}"`,
            createdBy: user?.displayName || 'Lofty AI Assistant',
          }
        );

        // Retain newly created PO in modal state
        setPurchaseOrders(prev => [newPo, ...prev.filter(p => p.id !== newPo.id)]);

        // Refresh POs
        await loadErpData();
        window.dispatchEvent(new CustomEvent('lofty:po-created', { detail: newPo }));

        setMessages(prev => [
          ...prev,
          {
            id: `ai-po-${Date.now()}`,
            sender: 'assistant',
            text: `✅ **Purchase Order Booked Successfully in MySQL!**\n\nI have generated and dispatched **${newPo.orderNumber}** to **${poOrder.vendor.name}** for **${poOrder.warehouse.name}**.`,
            createdPo: newPo,
            source: 'autonomous_agent',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsThinking(false);
        return;
      }

      // SCENARIO 3: Stock / Inventory Query
      if (lower.includes('stock') || lower.includes('inventory') || lower.includes('peenya') || lower.includes('bommasandra') || lower.includes('godown')) {
        let matchedWh = warehouses.find(w => lower.includes(w.name.toLowerCase()) || lower.includes((w.code || '').toLowerCase()));
        if (!matchedWh && lower.includes('peenya')) matchedWh = warehouses.find(w => w.id.includes('peenya'));
        if (!matchedWh && lower.includes('bommasandra')) matchedWh = warehouses.find(w => w.id.includes('bommasandra'));

        const targetWh = matchedWh || warehouses[0];
        const relevantBalances = targetWh
          ? stockBalances.filter(b => b.warehouseId === targetWh.id)
          : stockBalances;

        setMessages(prev => [
          ...prev,
          {
            id: `ai-stk-${Date.now()}`,
            sender: 'assistant',
            text: `📦 **Live Stock Report for ${targetWh ? targetWh.name : 'All Godowns'}:**\nThere are **${relevantBalances.reduce((s, b) => s + b.quantity, 0)} total units** across ${relevantBalances.length} materials.`,
            stockView: targetWh ? { warehouseName: targetWh.name, items: relevantBalances } : undefined,
            source: 'autonomous_agent',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsThinking(false);
        return;
      }

      // SCENARIO 4: Bills / Invoices Query
      if (lower.includes('bill') || lower.includes('invoice') || lower.includes('unpaid') || lower.includes('gst')) {
        const pendingBills = bills.filter(b => b.status === 'PENDING');
        const unpaidSum = pendingBills.reduce((acc, b) => acc + (b.totalAmount || 0), 0);

        setMessages(prev => [
          ...prev,
          {
            id: `ai-bills-${Date.now()}`,
            sender: 'assistant',
            text: `🧾 **Supplier Invoices & GST Status:**\nYou have **${pendingBills.length} unpaid bills** totaling **₹${unpaidSum.toLocaleString('en-IN')}** awaiting 3-way match & verification.`,
            billsView: pendingBills.slice(0, 4),
            source: 'autonomous_agent',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsThinking(false);
        return;
      }

      // SCENARIO 5: Deliveries Query
      if (lower.includes('delivery') || lower.includes('deliveries') || lower.includes('dock') || lower.includes('shipment')) {
        const pendingDels = deliveries.filter(d => d.status !== 'VERIFIED' && d.status !== 'REJECTED');
        setMessages(prev => [
          ...prev,
          {
            id: `ai-dels-${Date.now()}`,
            sender: 'assistant',
            text: `🚚 **Inbound Deliveries Pipeline:**\n**${pendingDels.length} shipments** currently awaiting carrier arrival or warehouse dock inspection.`,
            deliveriesView: pendingDels.slice(0, 3),
            source: 'autonomous_agent',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsThinking(false);
        return;
      }

      // SCENARIO 6: General Gemini Copilot
      const aiResponse = await askAiCopilot(promptText, ctx);
      setMessages(prev => [
        ...prev,
        {
          id: `ai-copilot-${Date.now()}`,
          sender: 'assistant',
          text: aiResponse.text,
          source: aiResponse.source,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Error executing request: ${err.message || 'Please try again.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/40 backdrop-blur-xs select-none">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 360 }}
          className={`bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden w-full transition-all ${
            isMinimized ? 'max-w-md h-[72px]' : 'max-w-xl h-[620px] max-h-[92vh]'
          }`}
          style={{
            boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.4), 0 0 35px 2px rgba(249, 115, 22, 0.12)',
          }}
        >
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between text-white border-b border-slate-700/60 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-orange-400 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-black tracking-tight text-white flex items-center">
                    Lofty AI Copilot
                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/30 text-orange-300 border border-orange-400/30">
                      Operations Copilot
                    </span>
                  </h3>
                </div>
                <p className="text-[10px] text-slate-300">
                  Gemini 3.5 Flash Lite • Orders, Inventory, Fraud & Deliveries
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setIsMinimized(prev => !prev)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Quick Action Suggestion Pills (Contextual to active business) */}
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center space-x-1.5 overflow-x-auto no-scrollbar shrink-0 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleExecutePrompt(`order 50 ${sampleProduct.toLowerCase()} from ${sampleVendor.toLowerCase()} to ${sampleWarehouse.toLowerCase()}`)}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-orange-50 hover:text-brand-600 border border-slate-200 text-slate-700 font-medium whitespace-nowrap shadow-2xs transition-colors flex items-center space-x-1"
                >
                  <ShoppingBag className="w-3 h-3 text-brand-600" />
                  <span>Order 50 {sampleProduct}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExecutePrompt(`check stock in ${sampleWarehouse.toLowerCase()}`)}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 hover:text-blue-600 border border-slate-200 text-slate-700 font-medium whitespace-nowrap shadow-2xs transition-colors flex items-center space-x-1"
                >
                  <Package className="w-3 h-3 text-blue-600" />
                  <span>{sampleWarehouse} Stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExecutePrompt('show unpaid supplier bills')}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200 text-slate-700 font-medium whitespace-nowrap shadow-2xs transition-colors flex items-center space-x-1"
                >
                  <Receipt className="w-3 h-3 text-emerald-600" />
                  <span>Unpaid GST Bills</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExecutePrompt('check pending inbound deliveries')}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-purple-50 hover:text-purple-600 border border-slate-200 text-slate-700 font-medium whitespace-nowrap shadow-2xs transition-colors flex items-center space-x-1"
                >
                  <Truck className="w-3 h-3 text-purple-600" />
                  <span>Dock Deliveries</span>
                </button>
              </div>

              {/* Chat Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
                {messages.map(m => (
                  <div
                    key={m.id}
                    className={`flex items-start space-x-2.5 ${m.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs shadow-2xs ${
                        m.sender === 'user'
                          ? 'bg-slate-800 text-white'
                          : 'bg-brand-600 text-white'
                      }`}
                    >
                      {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className="space-y-2 max-w-[84%]">
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          m.sender === 'user'
                            ? 'bg-slate-900 text-white rounded-tr-xs'
                            : 'bg-white border border-slate-200 text-slate-800 shadow-2xs rounded-tl-xs'
                        }`}
                      >
                        {/* Attached Image Preview */}
                        {m.attachedImage && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-slate-300 max-w-[180px]">
                            <img src={m.attachedImage} alt="Uploaded Doc" className="w-full h-auto object-cover" />
                          </div>
                        )}

                        {renderFormattedAiText(m.text, m.sender === 'user')}
                        <span
                          className={`text-[9px] block text-right mt-1 opacity-60 ${
                            m.sender === 'user' ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {m.timestamp}
                        </span>
                      </div>

                      {/* Autonomous PO Created Execution Card */}
                      {m.createdPo && (
                        <div className="p-3 bg-white rounded-xl border border-emerald-300 shadow-xs space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-700 flex items-center">
                              <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                              PO #{m.createdPo.orderNumber}
                            </span>
                            <Badge variant="success" size="sm">MySQL Recorded</Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-emerald-50/40 p-2 rounded-lg">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Vendor</span>
                              <strong className="text-slate-900">{m.createdPo.vendorName}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Destination</span>
                              <strong className="text-slate-900">{m.createdPo.warehouseName}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Items</span>
                              <strong className="text-slate-900">
                                {m.createdPo.items[0]?.quantity} {m.createdPo.items[0]?.unit} {m.createdPo.items[0]?.productName}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Total with GST</span>
                              <strong className="text-brand-600 font-bold">
                                ₹{(m.createdPo.grandTotal || 0).toLocaleString('en-IN')}
                              </strong>
                            </div>
                          </div>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              onClose();
                              navigate(`/purchases/${m.createdPo!.id}`);
                            }}
                            leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                            className="w-full text-xs"
                          >
                            View Purchase Order Details
                          </Button>
                        </div>
                      )}

                      {/* Autonomous Stock View Card */}
                      {m.stockView && (
                        <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-xs space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-blue-800 flex items-center">
                              <Boxes className="w-4 h-4 mr-1 text-blue-600" />
                              {m.stockView.warehouseName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {m.stockView.items.length} Products
                            </span>
                          </div>

                          <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                            {m.stockView.items.map(it => (
                              <div key={it.id} className="py-1.5 flex items-center justify-between text-[11px]">
                                <div className="truncate mr-2">
                                  <span className="font-semibold text-slate-800 block truncate">{it.productName}</span>
                                  <span className="text-[9px] text-slate-400 font-mono">{it.sku}</span>
                                </div>
                                <span className="font-bold text-slate-900 shrink-0">
                                  {it.quantity} units
                                </span>
                              </div>
                            ))}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onClose();
                              navigate('/inventory');
                            }}
                            className="w-full text-xs"
                          >
                            Open Full Inventory Ledger &rarr;
                          </Button>
                        </div>
                      )}

                      {/* Autonomous Bill Verification Result Card */}
                      {m.aiBillVerification && (
                        <div
                          className={`p-3 rounded-xl border text-xs space-y-2 ${
                            m.aiBillVerification.isAuthentic && !m.aiBillVerification.isScamOrSuspicious
                              ? 'bg-emerald-50/70 border-emerald-300'
                              : 'bg-rose-50/80 border-rose-300'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center">
                              {m.aiBillVerification.isAuthentic && !m.aiBillVerification.isScamOrSuspicious ? (
                                <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                              ) : (
                                <ShieldAlert className="w-4 h-4 mr-1 text-rose-600" />
                              )}
                              {m.aiBillVerification.isAuthentic && !m.aiBillVerification.isScamOrSuspicious
                                ? `Authentic ${m.aiBillVerification.documentType}`
                                : `Suspicious Document (Risk: ${m.aiBillVerification.scamRiskLevel})`}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-current font-semibold">
                              Confidence: {m.aiBillVerification.confidenceScore}%
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/70 p-2 rounded-lg">
                            <div>
                              <span className="text-slate-400 block">Detected Vendor</span>
                              <strong className="text-slate-800 truncate block">
                                {m.aiBillVerification.detectedVendor || 'N/A'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">GSTIN Format</span>
                              <strong className="text-slate-800 font-mono block">
                                {m.aiBillVerification.detectedGstin || 'Not found'}
                              </strong>
                            </div>
                          </div>

                          <p className="text-[11px] leading-relaxed text-slate-700 bg-white/60 p-2 rounded-md">
                            {m.aiBillVerification.verdict}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isThinking && (
                  <div className="flex items-center space-x-2 text-xs text-slate-500 p-2">
                    <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                    <span className="font-medium animate-pulse">
                      Lofty AI is analyzing live database & processing your command...
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Pending Upload Preview */}
              {pendingImage && (
                <div className="px-4 py-2 bg-orange-50 border-t border-orange-200 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <img src={pendingImage} alt="Attachment" className="w-9 h-9 object-cover rounded-md border border-orange-300" />
                    <div>
                      <span className="font-bold text-slate-800 block">Invoice image attached</span>
                      <span className="text-[10px] text-orange-700">Will be analyzed for authenticity by Gemini AI</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="p-1 rounded text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Input Footer */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleExecutePrompt();
                  }}
                  className="flex items-center space-x-2"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
                    title="Upload bill image for fraud check"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`p-2 rounded-xl transition-colors shrink-0 ${
                      isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title={isListening ? 'Stop Listening' : 'Speak to AI'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={isListening ? 'Listening to your voice...' : 'Instruct Lofty AI: "Order 50 copper wire..."'}
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50/70"
                    disabled={isThinking}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={(!input.trim() && !pendingImage) || isThinking}
                    className="rounded-xl px-3 py-2 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
