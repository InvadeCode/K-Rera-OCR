'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Loader2,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
} from 'lucide-react';
import type {
  AuditBatchResponse,
  AuditFinding,
  AuditLogItem,
  AuditReport,
  ChatMessage,
  LogStatus,
  Step,
} from '@/lib/types';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

const BATCH_SIZE = 6;

export default function Page() {
  const [step, setStep] = useState<Step>('idle');
  const [auditLog, setAuditLog] = useState<AuditLogItem[]>([]);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isPdfLibLoaded, setIsPdfLibLoaded] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentChatInput, setCurrentChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        setIsPdfLibLoaded(true);
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [auditLog]);

  const renderSafe = (val: unknown) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const addLog = (message: string, status: LogStatus = 'info') => {
    setAuditLog((prev) => [
      ...prev,
      {
        message: renderSafe(message),
        status,
        time: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const localFetch = async <T,>(url: string, body: unknown): Promise<T> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error || `Request failed with status ${response.status}`);
    }

    return data as T;
  };

  const resetSession = () => {
    setStep('idle');
    setReport(null);
    setAuditLog([]);
    setPreviews([]);
    setChatMessages([]);
    setProcessingError(null);
    setCurrentChatInput('');
  };

  const processDocument = async (file: File) => {
    if (!isPdfLibLoaded || !window.pdfjsLib) {
      setProcessingError('PDF renderer is still loading. Please try again in a moment.');
      return;
    }

    setStep('processing');
    setAuditLog([]);
    setProcessingError(null);
    setReport(null);
    setChatMessages([]);
    addLog('Initializing Statutory Scrutiny Engine...', 'info');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      addLog(`Object: ${file.name} | Total Layers: ${pdf.numPages}`, 'success');

      const pageImages: string[] = [];
      const scale = 1.2;

      for (let i = 1; i <= pdf.numPages; i += 1) {
        addLog(`Rendering Layer ${i} of ${pdf.numPages}...`, 'info');
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error(`Failed to create canvas context for page ${i}.`);
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        pageImages.push(canvas.toDataURL('image/png', 0.8).split(',')[1]);
      }

      setPreviews(pageImages.map((img) => `data:image/png;base64,${img}`));
      await executeBatchAudit(pageImages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown processing error.';
      addLog(`System Halt: ${message}`, 'error');
      setProcessingError(message);
      setStep('idle');
    }
  };

  const executeBatchAudit = async (images: string[]) => {
    const batches: string[][] = [];
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      batches.push(images.slice(i, i + BATCH_SIZE));
    }

    addLog(`Splitting document into ${batches.length} analytical batches...`, 'info');

    let allFindings: AuditFinding[] = [];
    let detectedProject = 'Unknown';
    let isMismatch = false;

    for (let i = 0; i < batches.length; i += 1) {
      addLog(`Auditing Cluster ${i + 1}/${batches.length}...`, 'warning');

      try {
        const data = await localFetch<AuditBatchResponse>('/api/audit-batch', {
          images: batches[i],
        });

        if (data.project && data.project !== 'Unknown') {
          detectedProject = data.project;
        }

        allFindings = [...allFindings, ...(data.findings || [])];

        if (data.jurisdiction === 'Mismatch') {
          isMismatch = true;
          addLog('ALARM: Jurisdictional Protocol Mismatch detected.', 'error');
          break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown batch error.';
        throw new Error(`Cluster ${i + 1} analysis failed: ${message}`);
      }
    }

    addLog('Consolidating full document results...', 'info');

    const finalReport: AuditReport = {
      jurisdiction: isMismatch ? 'Mismatch' : 'Kerala',
      score: isMismatch ? 0 : Math.max(0, 100 - allFindings.length * 5),
      project: detectedProject,
      executiveSummary: isMismatch
        ? 'REJECTED: Document identifies Maharashtra land records (Village Forms/7-12). Mismatch with Kerala K-RERA jurisdiction.'
        : `Full statutory audit finalized. Scrutinized ${allFindings.length} deviations across ${images.length} pages of Annexure-A.`,
      findings: allFindings,
    };

    setReport(finalReport);
    setStep('complete');
  };

  const handleSendMessage = async () => {
    if (!currentChatInput.trim() || isChatLoading || !report) return;

    const msg = currentChatInput.trim();
    setChatMessages((prev) => [...prev, { role: 'user', text: msg }]);
    setCurrentChatInput('');
    setIsChatLoading(true);

    try {
      const data = await localFetch<{ text: string }>('/api/chat', {
        message: msg,
        report,
      });

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.text || 'No response returned.' },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Service link interrupted.' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#FDFDFD] font-sans text-[11px] tracking-tight text-slate-800 selection:bg-indigo-100 flex flex-col">
      <nav className="sticky top-0 z-50 h-12 shrink-0 border-b border-slate-100 bg-white/80 px-8 shadow-sm backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-indigo-600 shadow-md">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="leading-none">
            <span className="block text-[12px] font-bold uppercase tracking-widest text-slate-900">
              K-RERA Audit.OS
            </span>
            <span className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-slate-400">
              Statutory Intelligence Unit
            </span>
          </div>
        </div>

        {step !== 'idle' && (
          <button
            onClick={resetSession}
            className="h-8 rounded bg-slate-900 px-4 text-[9px] font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800 shadow-sm"
          >
            New Session
          </button>
        )}
      </nav>

      <div className="flex-1 overflow-y-auto">
        <main
          className={`relative w-full ${
            step === 'idle'
              ? 'h-[calc(100vh-48px)] flex items-center justify-center p-8'
              : 'p-8 md:p-12'
          }`}
        >
          {step === 'idle' && (
            <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-700">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[2rem] border-2 border-dashed bg-white transition-all group ${
                  processingError
                    ? 'border-rose-200 bg-rose-50/5'
                    : 'border-slate-200 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-50/10'
                }`}
              >
                <div className="absolute inset-0 bg-indigo-600/5 opacity-0 transition-opacity group-hover:opacity-100" />

                {processingError ? (
                  <div className="p-6 text-center">
                    <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-rose-500" />
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-rose-900">
                      Protocol Halted
                    </p>
                    <p className="mx-auto mb-6 max-w-[180px] text-[9px] leading-tight text-rose-400">
                      {processingError}
                    </p>
                    <button className="rounded bg-rose-600 px-5 py-2 text-[9px] font-black uppercase text-white shadow-lg">
                      Try Again
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white">
                      <Upload className="h-6 w-6" />
                    </div>
                    <h2 className="mb-0.5 text-[14px] font-black uppercase tracking-tighter text-slate-900">
                      Injection Portal
                    </h2>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      K-RERA Statutory Audit (24-Layer)
                    </p>
                  </>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void processDocument(file);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex min-h-[50vh] h-full flex-col items-center justify-center">
              <div className="relative mb-6 flex h-12 w-12 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-slate-100" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-indigo-500" />
                <Loader2 className="h-5 w-5 text-indigo-500" />
              </div>
              <span className="animate-pulse text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">
                Running Neural Scrutiny sequence
              </span>
              <p className="mt-4 text-[8px] uppercase tracking-[0.2em] text-slate-300">
                Batch processing multi-page document
              </p>
            </div>
          )}

          {step === 'complete' && report && (
            <div className="mx-auto max-w-4xl space-y-10 pb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div
                className={`relative flex flex-col items-start gap-10 overflow-hidden rounded-[1.5rem] border bg-white p-8 shadow-2xl md:flex-row ${
                  report.jurisdiction === 'Mismatch'
                    ? 'border-rose-100 bg-rose-50/5'
                    : 'border-slate-100 shadow-slate-100/50'
                }`}
              >
                <div className="relative shrink-0">
                  <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F8FAFC" strokeWidth="2.5" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke={report.score > 70 ? '#10b981' : '#f43f5e'}
                      strokeWidth="3"
                      strokeDasharray={`${report.score}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black leading-none text-slate-900">
                      {report.score}%
                    </span>
                    <span className="mt-1 text-[7px] font-black uppercase tracking-widest text-slate-400">
                      Audit Index
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="mb-3 flex gap-2">
                    <span
                      className={`rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                        report.jurisdiction === 'Kerala'
                          ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                          : 'border-rose-700 bg-rose-600 text-white shadow-lg shadow-rose-100'
                      }`}
                    >
                      {report.jurisdiction === 'Kerala'
                        ? 'Validated: Kerala Protocol'
                        : 'Protocol Violation'}
                    </span>
                  </div>

                  <h2 className="mb-2 text-[16px] font-black uppercase tracking-tighter leading-none text-slate-900">
                    {renderSafe(report.project) || 'FORMAT MISMATCH'}
                  </h2>
                  <p className="border-l-2 border-indigo-100 pl-4 text-[11px] font-medium italic leading-snug text-slate-500 opacity-90">
                    "{renderSafe(report.executiveSummary)}"
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 px-3">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  <h3 className="text-[9px] font-black uppercase tracking-[0.3em] leading-none text-slate-400">
                    Scrutiny Findings
                  </h3>
                </div>

                <div className="grid gap-3">
                  {report.findings.length > 0 ? (
                    report.findings.map((f, i) => (
                      <div
                        key={`${f.para}-${i}`}
                        className={`rounded-[1.2rem] border bg-white p-6 shadow-sm transition-all hover:shadow-md ${
                          f.severity === 'CRITICAL'
                            ? 'border-rose-100 bg-rose-50/5 shadow-rose-100/10'
                            : 'border-slate-100'
                        }`}
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <span className="rounded border border-slate-100 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest leading-none text-slate-900">
                            {renderSafe(f.para)}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest leading-none ${
                              f.severity === 'CRITICAL'
                                ? 'border-rose-100 text-rose-600'
                                : 'border-slate-200 text-slate-500'
                            }`}
                          >
                            {renderSafe(f.severity)} Deviation
                          </span>
                        </div>
                        <h4 className="mb-2 text-[13px] font-bold leading-tight tracking-tight text-slate-900">
                          {renderSafe(f.finding)}
                        </h4>
                        <div className="rounded-lg border border-slate-100/50 bg-slate-50/50 p-3">
                          <p className="text-[11px] font-medium leading-tight text-slate-500">
                            <span className="mr-2 text-[9px] font-black uppercase tracking-widest text-indigo-600">
                              Neural Remedy:
                            </span>
                            {renderSafe(f.rectification)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-100 bg-white p-16 text-center text-[11px] italic text-slate-400 shadow-sm">
                      No statutory anomalies detected in current document layers.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6 border-t border-slate-100 pt-10">
                <section className="flex h-[220px] flex-col overflow-hidden rounded-[1.2rem] border border-slate-100 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/30 p-4">
                    <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest leading-none text-slate-400">
                      <Terminal className="h-3 w-3" /> Neural Trace Log
                    </span>
                  </div>
                  <div className="scrollbar-hide flex-1 space-y-2 overflow-y-auto p-4 text-[10px] font-medium leading-none">
                    {auditLog.map((l, i) => (
                      <div key={`${l.time}-${i}`} className="flex gap-3 border-l-2 border-slate-100 pl-3">
                        <span className="shrink-0 font-mono text-[8px] text-slate-300">{l.time}</span>
                        <span
                          className={
                            l.status === 'success'
                              ? 'font-bold text-emerald-600'
                              : l.status === 'error'
                                ? 'font-bold text-rose-600'
                                : 'text-slate-500'
                          }
                        >
                          {renderSafe(l.message)}
                        </span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </section>

                <section className="flex flex-col overflow-hidden rounded-[1.2rem] border border-slate-100 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/30 p-4">
                    <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest leading-none text-slate-400">
                      <BarChart3 className="h-3 w-3" /> Visual metadata layers ({previews.length} total)
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 p-6 md:grid-cols-6 lg:grid-cols-8">
                    {previews.map((preview, i) => (
                      <div
                        key={`preview-${i}`}
                        className="aspect-[3/4] cursor-zoom-in overflow-hidden rounded-sm border border-slate-100 bg-slate-50 opacity-60 shadow-sm transition-all hover:scale-105 hover:opacity-100"
                      >
                        <img
                          src={preview}
                          className="h-full w-full object-cover"
                          alt={`Layer ${i + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-2xl shadow-slate-100/30">
                  <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/30 p-4">
                    <div className="rounded bg-indigo-50 p-1.5 shadow-sm">
                      <MessageSquare className="h-4 w-4 text-indigo-600" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest leading-none text-slate-400">
                      K-RERA Legal Consultant Assistant
                    </span>
                  </div>

                  <div className="flex h-[350px] flex-col md:flex-row">
                    <div className="w-full border-r border-slate-100 bg-slate-50/30 p-6 text-[10px] font-medium italic leading-tight text-slate-400 md:w-1/3">
                      Trained on Kerala Real Estate (Regulation and Development) Rules 2018. Query findings or request statutory-compliant clause re-drafts.
                    </div>

                    <div className="flex flex-1 flex-col bg-white">
                      <div className="scrollbar-hide flex-1 space-y-4 overflow-y-auto p-6">
                        {chatMessages.length === 0 && (
                          <div className="flex h-full flex-col items-center justify-center gap-3 opacity-20 grayscale">
                            <Sparkles className="h-8 w-8" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">
                              Session Ready
                            </span>
                          </div>
                        )}

                        {chatMessages.map((message, i) => (
                          <div
                            key={`chat-${i}`}
                            className={`max-w-[85%] rounded-[1.2rem] p-4 text-[11px] leading-snug shadow-sm ${
                              message.role === 'user'
                                ? 'ml-auto rounded-tr-none bg-indigo-600 text-white'
                                : 'mr-auto rounded-tl-none border border-slate-100 bg-slate-50 text-slate-700'
                            }`}
                          >
                            {renderSafe(message.text)}
                          </div>
                        ))}

                        {isChatLoading && (
                          <Loader2 className="mx-auto mt-2 h-4 w-4 animate-spin text-indigo-600" />
                        )}
                      </div>

                      <div className="flex gap-3 border-t border-slate-100 bg-slate-50/20 p-4">
                        <input
                          value={currentChatInput}
                          onChange={(e) => setCurrentChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void handleSendMessage();
                            }
                          }}
                          placeholder="Technical inquiry..."
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[11px] text-slate-900 outline-none transition-all focus:border-indigo-400 shadow-sm"
                        />
                        <button
                          onClick={() => void handleSendMessage()}
                          className="rounded-xl bg-indigo-600 px-5 py-3 text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
