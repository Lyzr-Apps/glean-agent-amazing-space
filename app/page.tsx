'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { callAIAgent } from '@/lib/aiAgent';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FiSearch, FiX, FiChevronDown, FiChevronUp, FiExternalLink, FiMenu, FiFileText, FiInfo, FiArrowRight, FiLoader, FiUpload, FiUploadCloud, FiTrash2, FiCheck, FiAlertCircle, FiGlobe, FiLink } from 'react-icons/fi';

// ---- Types ----
interface HistoryItem {
  id: string;
  query: string;
  timestamp: string;
  resultSummary: string;
}

interface SearchResultData {
  answer: string;
  confidence: string;
  related_topics: string[];
}

interface ParsedResult {
  summary: string;
  data: SearchResultData;
  items: any[];
}

interface AgentResponse {
  status: string;
  result: ParsedResult;
  message?: string;
  metadata?: {
    agent_name: string;
    timestamp: string;
  };
}

interface KBDocument {
  fileName: string;
  fileType: string;
  status: string;
}

interface UploadStatus {
  fileName: string;
  status: 'uploading' | 'success' | 'error';
  message?: string;
}

interface CrawlStatus {
  url: string;
  status: 'crawling' | 'success' | 'error';
  message?: string;
  pagesProcessed?: number;
}

// ---- Constants ----
const AGENT_ID = '698a4e160c99533d5b94b432';
const RAG_ID = '698a4e05de7de278e55d2e44';
const HISTORY_KEY = 'knowledge_search_history';
const ACCEPTED_FILE_TYPES = '.pdf,.docx,.txt';

const DOC_TYPE_FILTERS = ['Policies', 'Wikis', 'Guides', 'FAQs'];
const DEPT_FILTERS = ['Engineering', 'HR', 'Finance', 'Marketing', 'Operations'];

const SAMPLE_RESULTS: AgentResponse = {
  status: 'success',
  result: {
    summary: 'The company offers a comprehensive remote work policy allowing eligible employees to work remotely up to 3 days per week, with core hours from 10am-3pm in their local time zone.',
    data: {
      answer: 'Based on the company knowledge base, the remote work policy includes the following key points:\n\n1. **Eligibility**: All full-time employees who have completed their probationary period (90 days) are eligible for remote work arrangements.\n\n2. **Schedule**: Employees may work remotely up to 3 days per week. Core collaboration hours are 10:00 AM to 3:00 PM in the employee\'s local time zone.\n\n3. **Equipment**: The company provides a laptop, monitor, and ergonomic accessories for home office setup. A one-time stipend of $500 is available for additional home office needs.\n\n4. **Communication**: Teams must use Slack for daily communication and maintain updated availability status. Video calls are expected for all team meetings.\n\n5. **Security**: All remote work must be conducted via the company VPN. Sensitive documents should not be accessed on public networks.',
      confidence: 'high',
      related_topics: ['Employee handbook', 'Work from home best practices', 'IT security policies', 'Equipment reimbursement', 'Time tracking guidelines'],
    },
    items: [
      { id: 1, title: 'Remote Work Policy v3.2', excerpt: 'Section 4.1 outlines eligibility criteria for remote work arrangements including the 90-day probationary period requirement...', department: 'HR', lastUpdated: '2024-05-15', type: 'Policy' },
      { id: 2, title: 'Home Office Equipment Guide', excerpt: 'All approved remote employees will receive standard equipment including a company laptop, external monitor, and ergonomic keyboard...', department: 'IT', lastUpdated: '2024-04-22', type: 'Guide' },
      { id: 3, title: 'Information Security - Remote Access', excerpt: 'VPN connection is mandatory for accessing company resources remotely. Multi-factor authentication must be enabled...', department: 'IT Security', lastUpdated: '2024-06-01', type: 'Policy' },
    ],
  },
  metadata: {
    agent_name: 'Knowledge Search Agent',
    timestamp: '2024-06-13T03:00:54Z',
  },
};

const SAMPLE_HISTORY: HistoryItem[] = [
  { id: '1', query: 'What are the company remote work policies?', timestamp: '2024-06-13T03:00:54Z', resultSummary: 'Comprehensive remote work policy allowing up to 3 days per week...' },
  { id: '2', query: 'How do I submit expense reports?', timestamp: '2024-06-12T14:22:10Z', resultSummary: 'Expense reports should be submitted through the Finance portal within 30 days...' },
  { id: '3', query: 'What is the PTO accrual rate?', timestamp: '2024-06-11T09:15:33Z', resultSummary: 'Full-time employees accrue 15 days PTO in their first year...' },
];

// ---- Helpers ----
const parseResult = (result: any): ParsedResult => {
  if (typeof result === 'string') {
    try {
      return JSON.parse(result);
    } catch {
      return { summary: result, data: { answer: result, confidence: 'low', related_topics: [] }, items: [] };
    }
  }
  return result ?? { summary: '', data: { answer: '', confidence: 'low', related_topics: [] }, items: [] };
};

const formatTimestamp = (ts: string): string => {
  try {
    const date = new Date(ts);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
};

const getConfidenceBadge = (confidence: string) => {
  const level = (confidence ?? '').toLowerCase();
  if (level === 'high') {
    return { label: 'High Confidence', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
  if (level === 'medium') {
    return { label: 'Medium Confidence', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  return { label: 'Low Confidence', className: 'bg-red-100 text-red-700 border-red-200' };
};

// ---- Inline Components ----

function LoadingSkeleton() {
  return (
    <div className="space-y-6 mt-8">
      <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[0.875rem] overflow-hidden">
        <div className="border-l-4 border-primary p-6">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-28 rounded-full ml-auto" />
          </div>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6 mb-2" />
          <Skeleton className="h-4 w-4/6 mb-4" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </Card>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[0.875rem] p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (query: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <FiSearch className="w-9 h-9 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold text-foreground tracking-[-0.01em] mb-2">What would you like to know?</h2>
      <p className="text-muted-foreground text-center max-w-md leading-[1.55]">Search across company policies, wikis, guides, and FAQs. Ask any question and get AI-powered answers from your internal knowledge base.</p>
      <div className="flex flex-wrap gap-2 mt-8 justify-center">
        {['Remote work policies', 'Expense report process', 'PTO accrual rates', 'IT security guidelines'].map((suggestion) => (
          <button key={suggestion} onClick={() => onSuggestionClick(suggestion)} className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer transition-colors hover:bg-primary/10 hover:text-primary">
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterChips({
  activeFilters,
  onToggle,
}: {
  activeFilters: string[];
  onToggle: (filter: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <span className="text-xs font-medium text-muted-foreground mr-1 self-center">Type:</span>
      {DOC_TYPE_FILTERS.map((filter) => {
        const isActive = activeFilters.includes(filter);
        return (
          <button key={filter} onClick={() => onToggle(filter)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-white/60 text-muted-foreground border-border hover:bg-secondary hover:text-secondary-foreground'}`}>
            {filter}
          </button>
        );
      })}
      <Separator orientation="vertical" className="h-6 mx-1 self-center" />
      <span className="text-xs font-medium text-muted-foreground mr-1 self-center">Dept:</span>
      {DEPT_FILTERS.map((filter) => {
        const isActive = activeFilters.includes(filter);
        return (
          <button key={filter} onClick={() => onToggle(filter)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-white/60 text-muted-foreground border-border hover:bg-secondary hover:text-secondary-foreground'}`}>
            {filter}
          </button>
        );
      })}
    </div>
  );
}

function AnswerCard({ result }: { result: ParsedResult }) {
  const confidence = getConfidenceBadge(result?.data?.confidence ?? 'low');
  const answer = result?.data?.answer ?? result?.summary ?? '';
  const relatedTopics = Array.isArray(result?.data?.related_topics) ? result.data.related_topics : [];

  return (
    <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[0.875rem] overflow-hidden mt-8">
      <div className="border-l-4 border-primary">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <FiInfo className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold tracking-[-0.01em]">Answer</CardTitle>
            </div>
            <Badge variant="outline" className={`${confidence.className} text-xs font-medium`}>
              {confidence.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {result?.summary && (
            <p className="text-sm font-medium text-foreground leading-[1.55] bg-primary/5 px-4 py-3 rounded-lg">{result.summary}</p>
          )}
          <div className="text-sm text-foreground/90 leading-[1.7] whitespace-pre-line">{answer}</div>
          {relatedTopics.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Related Topics</p>
              <div className="flex flex-wrap gap-2">
                {relatedTopics.map((topic, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium cursor-default transition-colors hover:bg-primary/10">
                    <FiArrowRight className="w-3 h-3" />
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

function SourceCard({
  item,
  index,
  isExpanded,
  onToggle,
}: {
  item: any;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const title = item?.title ?? `Source ${index + 1}`;
  const excerpt = item?.excerpt ?? '';
  const department = item?.department ?? '';
  const lastUpdated = item?.lastUpdated ?? '';
  const docType = item?.type ?? '';

  return (
    <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[0.875rem] transition-all duration-200 hover:shadow-lg">
      <button onClick={onToggle} className="w-full text-left p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FiFileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-foreground truncate tracking-[-0.01em]">{title}</h4>
              {docType && (
                <Badge variant="outline" className="text-[10px] font-medium bg-secondary/80">{docType}</Badge>
              )}
            </div>
            {!isExpanded && excerpt && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{excerpt}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {department && (
              <Badge variant="secondary" className="text-[10px] font-medium hidden sm:inline-flex">{department}</Badge>
            )}
            {isExpanded ? <FiChevronUp className="w-4 h-4 text-muted-foreground" /> : <FiChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <Separator className="mb-3" />
          <p className="text-sm text-foreground/80 leading-[1.55] mb-3">{excerpt}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              {department && <span className="flex items-center gap-1"><Badge variant="secondary" className="text-[10px]">{department}</Badge></span>}
              {lastUpdated && <span>Updated: {lastUpdated}</span>}
            </div>
            <button className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium">
              <FiExternalLink className="w-3 h-3" />
              View Document
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function HistorySidebar({
  history,
  onSelect,
  onClear,
  isOpen,
  onClose,
}: {
  history: HistoryItem[];
  onSelect: (query: string) => void;
  onClear: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden" onClick={onClose} />
      )}
      <aside className={`fixed top-0 left-0 z-40 h-full w-72 bg-white/80 backdrop-blur-[20px] border-r border-border/50 shadow-xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:z-10 lg:shadow-none lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground tracking-[-0.01em]">Search History</h3>
            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <button onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10">Clear All</button>
              )}
              <button onClick={onClose} className="lg:hidden p-1 rounded-md hover:bg-secondary">
                <FiX className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <FiSearch className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No search history yet</p>
                </div>
              ) : (
                history.map((item) => (
                  <button key={item.id} onClick={() => onSelect(item.query)} className="w-full text-left p-3 rounded-lg hover:bg-secondary/80 transition-colors group">
                    <p className="text-sm font-medium text-foreground line-clamp-2 tracking-[-0.01em] group-hover:text-primary transition-colors">{item.query}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{item.resultSummary}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{formatTimestamp(item.timestamp)}</p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </aside>
    </>
  );
}

function DocumentUploadPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlHistory, setCrawlHistory] = useState<CrawlStatus[]>([]);
  const [activeTab, setActiveTab] = useState<'files' | 'website'>('files');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch('/api/rag', {
        headers: { 'x-rag-id': RAG_ID },
      });
      if (res.ok) {
        const data = await res.json();
        const docs = Array.isArray(data?.documents) ? data.documents : Array.isArray(data) ? data : [];
        setDocuments(docs);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
      setStatusMessage(null);
    }
  }, [isOpen, fetchDocuments]);

  const isValidFile = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ['pdf', 'docx', 'txt'].includes(ext);
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(isValidFile);
    if (fileArray.length === 0) {
      setStatusMessage({ text: 'No valid files selected. Accepted types: PDF, DOCX, TXT', type: 'error' });
      return;
    }

    const newUploads: UploadStatus[] = fileArray.map((f) => ({
      fileName: f.name,
      status: 'uploading' as const,
    }));
    setUploads((prev) => [...newUploads, ...prev]);
    setStatusMessage(null);

    let successCount = 0;
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        const formData = new FormData();
        formData.append('ragId', RAG_ID);
        formData.append('file', file);
        const res = await fetch('/api/rag', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          setUploads((prev) =>
            prev.map((u) =>
              u.fileName === file.name ? { ...u, status: 'success' as const, message: 'Uploaded successfully' } : u
            )
          );
          successCount++;
        } else {
          const errData = await res.json().catch(() => ({}));
          setUploads((prev) =>
            prev.map((u) =>
              u.fileName === file.name ? { ...u, status: 'error' as const, message: errData?.error ?? 'Upload failed' } : u
            )
          );
        }
      } catch {
        setUploads((prev) =>
          prev.map((u) =>
            u.fileName === file.name ? { ...u, status: 'error' as const, message: 'Network error' } : u
          )
        );
      }
    }

    if (successCount > 0) {
      setStatusMessage({ text: `${successCount} file(s) uploaded and queued for training`, type: 'success' });
      fetchDocuments();
    }
  }, [fetchDocuments]);

  const handleDelete = useCallback(async (fileName: string) => {
    setDeletingFiles((prev) => new Set(prev).add(fileName));
    try {
      const res = await fetch('/api/rag', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ragId: RAG_ID, documentNames: [fileName] }),
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.fileName !== fileName));
        setStatusMessage({ text: `"${fileName}" deleted successfully`, type: 'success' });
      } else {
        setStatusMessage({ text: `Failed to delete "${fileName}"`, type: 'error' });
      }
    } catch {
      setStatusMessage({ text: `Error deleting "${fileName}"`, type: 'error' });
    } finally {
      setDeletingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  }, [handleFiles]);

  const handleCrawl = useCallback(async () => {
    const url = crawlUrl.trim();
    if (!url) return;

    // Basic URL validation
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      setStatusMessage({ text: 'Please enter a valid URL (e.g., https://example.com)', type: 'error' });
      return;
    }

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    const newCrawl: CrawlStatus = { url: normalizedUrl, status: 'crawling' };
    setCrawlHistory((prev) => [newCrawl, ...prev]);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/rag/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ragId: RAG_ID, url: normalizedUrl }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setCrawlHistory((prev) =>
          prev.map((c) =>
            c.url === normalizedUrl && c.status === 'crawling'
              ? { ...c, status: 'success' as const, message: `Crawled successfully (${data.pagesProcessed || 0} pages processed)`, pagesProcessed: data.pagesProcessed }
              : c
          )
        );
        setStatusMessage({ text: `Website crawled and indexed successfully`, type: 'success' });
        setCrawlUrl('');
        fetchDocuments();
      } else {
        setCrawlHistory((prev) =>
          prev.map((c) =>
            c.url === normalizedUrl && c.status === 'crawling'
              ? { ...c, status: 'error' as const, message: data.error || 'Crawl failed' }
              : c
          )
        );
        setStatusMessage({ text: data.error || 'Website crawl failed', type: 'error' });
      }
    } catch {
      setCrawlHistory((prev) =>
        prev.map((c) =>
          c.url === normalizedUrl && c.status === 'crawling'
            ? { ...c, status: 'error' as const, message: 'Network error' }
            : c
        )
      );
      setStatusMessage({ text: 'Network error during crawl', type: 'error' });
    }
  }, [crawlUrl, fetchDocuments]);

  const getFileExtBadge = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
    const colorMap: Record<string, string> = {
      PDF: 'bg-red-100 text-red-700 border-red-200',
      DOCX: 'bg-blue-100 text-blue-700 border-blue-200',
      TXT: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return { ext, className: colorMap[ext] ?? 'bg-gray-100 text-gray-600 border-gray-200' };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col backdrop-blur-[16px] bg-white/90 border border-white/[0.18] shadow-xl rounded-[0.875rem] overflow-hidden">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FiUploadCloud className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground tracking-[-0.01em]">Knowledge Base</h2>
              <p className="text-xs text-muted-foreground">Upload files or crawl websites for AI-powered search</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <FiX className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50">
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${activeTab === 'files' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30'}`}
          >
            <FiUpload className="w-4 h-4" />
            Upload Files
          </button>
          <button
            onClick={() => setActiveTab('website')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${activeTab === 'website' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30'}`}
          >
            <FiGlobe className="w-4 h-4" />
            Crawl Website
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status Message */}
          {statusMessage && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {statusMessage.type === 'success' ? <FiCheck className="w-4 h-4 flex-shrink-0" /> : <FiAlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{statusMessage.text}</span>
              <button onClick={() => setStatusMessage(null)} className="ml-auto p-0.5 rounded hover:bg-black/5">
                <FiX className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* FILE UPLOAD TAB */}
          {activeTab === 'files' && (
            <>
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-[0.875rem] p-8 text-center transition-all duration-200 cursor-pointer ${isDragOver ? 'border-primary bg-primary/5 shadow-inner' : 'border-border/70 hover:border-primary/50 hover:bg-primary/[0.02]'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isDragOver ? 'bg-primary/15' : 'bg-primary/10'}`}>
                    <FiUploadCloud className={`w-7 h-7 transition-colors ${isDragOver ? 'text-primary' : 'text-primary/70'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse -- PDF, DOCX, TXT accepted</p>
                  </div>
                </div>
              </div>

              {/* Upload Progress */}
              {uploads.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Recent Uploads</h3>
                    <button onClick={() => setUploads([])} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                  </div>
                  <div className="space-y-1.5">
                    {uploads.map((upload, i) => (
                      <div key={`${upload.fileName}-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/30">
                        <div className="flex-shrink-0">
                          {upload.status === 'uploading' && <FiLoader className="w-4 h-4 text-primary animate-spin" />}
                          {upload.status === 'success' && <FiCheck className="w-4 h-4 text-emerald-600" />}
                          {upload.status === 'error' && <FiAlertCircle className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{upload.fileName}</p>
                          {upload.message && (
                            <p className={`text-[11px] mt-0.5 ${upload.status === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}>{upload.message}</p>
                          )}
                        </div>
                        {upload.status === 'uploading' && (
                          <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* WEBSITE CRAWL TAB */}
          {activeTab === 'website' && (
            <>
              {/* Crawl Input */}
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Website URL</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FiLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="url"
                        placeholder="https://example.com"
                        value={crawlUrl}
                        onChange={(e) => setCrawlUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCrawl();
                          }
                        }}
                        className="pl-10 h-10 text-sm rounded-[0.625rem] bg-white/60 border border-border/70 focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <Button
                      onClick={handleCrawl}
                      disabled={!crawlUrl.trim() || crawlHistory.some((c) => c.status === 'crawling')}
                      className="h-10 px-5 rounded-[0.625rem] text-sm font-medium"
                    >
                      {crawlHistory.some((c) => c.status === 'crawling') ? (
                        <FiLoader className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <FiGlobe className="w-4 h-4 mr-1.5" />
                          Crawl
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Enter a website URL to crawl and index its content into the knowledge base. The crawler will follow internal links and extract text from all reachable pages.
                  </p>
                </div>
              </div>

              {/* Crawl History */}
              {crawlHistory.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Crawl History</h3>
                    <button
                      onClick={() => setCrawlHistory((prev) => prev.filter((c) => c.status === 'crawling'))}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear Completed
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {crawlHistory.map((crawl, i) => (
                      <div key={`${crawl.url}-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/30">
                        <div className="flex-shrink-0">
                          {crawl.status === 'crawling' && <FiLoader className="w-4 h-4 text-primary animate-spin" />}
                          {crawl.status === 'success' && <FiCheck className="w-4 h-4 text-emerald-600" />}
                          {crawl.status === 'error' && <FiAlertCircle className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <FiGlobe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <p className="text-sm text-foreground truncate">{crawl.url}</p>
                          </div>
                          {crawl.message && (
                            <p className={`text-[11px] mt-0.5 ${crawl.status === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}>{crawl.message}</p>
                          )}
                        </div>
                        {crawl.status === 'crawling' && (
                          <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '45%' }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Existing Documents (shown on both tabs) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Documents in Knowledge Base</h3>
              <button onClick={fetchDocuments} disabled={loadingDocs} className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50">
                {loadingDocs ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {loadingDocs ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-secondary/30">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-3.5 w-48 mb-1.5" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="w-8 h-8 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-10 rounded-lg border border-dashed border-border/50">
                <FiFileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No documents found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Upload files or crawl a website to populate your knowledge base</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {documents.map((doc) => {
                  const badge = getFileExtBadge(doc.fileName);
                  const isDeleting = deletingFiles.has(doc.fileName);
                  return (
                    <div key={doc.fileName} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/30 transition-all duration-200 hover:bg-secondary/30 ${isDeleting ? 'opacity-50' : ''}`}>
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FiFileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                        {doc.status && (
                          <p className="text-[11px] text-muted-foreground capitalize">{doc.status}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={`text-[10px] font-medium flex-shrink-0 ${badge.className}`}>{badge.ext}</Badge>
                      <button
                        onClick={() => handleDelete(doc.fileName)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                        title="Delete document"
                      >
                        {isDeleting ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiTrash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel Footer */}
        <div className="px-6 py-3 border-t border-border/50 bg-secondary/20">
          <p className="text-[11px] text-muted-foreground text-center">
            {activeTab === 'files'
              ? 'Uploaded documents are processed and indexed for AI-powered knowledge search'
              : 'Crawled website content is extracted and indexed for AI-powered knowledge search'}
          </p>
        </div>
      </div>
    </div>
  );
}

function AgentStatusCard({ isActive }: { isActive: boolean }) {
  return (
    <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-sm rounded-[0.875rem]">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? 'bg-primary animate-pulse' : 'bg-emerald-500'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground tracking-[-0.01em]">Knowledge Search Agent</p>
            <p className="text-[10px] text-muted-foreground">AI-powered internal knowledge base search</p>
          </div>
          <Badge variant="outline" className="text-[10px] flex-shrink-0">{isActive ? 'Processing' : 'Ready'}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Main Page ----
export default function Home() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AgentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const [sampleMode, setSampleMode] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback((history: HistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, []);

  // Sample mode toggle
  useEffect(() => {
    if (sampleMode) {
      setSearchResults(SAMPLE_RESULTS);
      setSearchHistory(SAMPLE_HISTORY);
      setQuery('What are the company remote work policies?');
    } else {
      setSearchResults(null);
      setQuery('');
      // Restore real history
      try {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setSearchHistory(parsed);
          } else {
            setSearchHistory([]);
          }
        } else {
          setSearchHistory([]);
        }
      } catch {
        setSearchHistory([]);
      }
    }
    setExpandedSources(new Set());
  }, [sampleMode]);

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q) return;

    setIsLoading(true);
    setActiveAgentId(AGENT_ID);
    setExpandedSources(new Set());
    setSearchResults(null);

    try {
      const result = await callAIAgent(q, AGENT_ID);
      if (result?.success && result?.response) {
        const parsed = parseResult(result.response?.result);
        const response: AgentResponse = {
          status: result.response?.status ?? 'success',
          result: parsed,
          metadata: result.response?.metadata,
        };
        setSearchResults(response);

        // Add to history
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          query: q,
          timestamp: new Date().toISOString(),
          resultSummary: parsed?.summary ?? 'Search completed',
        };
        setSearchHistory((prev) => {
          const updated = [newItem, ...prev.filter((h) => h.query !== q)].slice(0, 20);
          saveHistory(updated);
          return updated;
        });
      } else {
        setSearchResults({
          status: 'error',
          result: {
            summary: 'Search could not be completed. Please try again.',
            data: { answer: result?.response?.message ?? 'An error occurred while searching. Please try again.', confidence: 'low', related_topics: [] },
            items: [],
          },
        });
      }
    } catch (err) {
      setSearchResults({
        status: 'error',
        result: {
          summary: 'An unexpected error occurred.',
          data: { answer: 'There was a problem connecting to the search service. Please check your connection and try again.', confidence: 'low', related_topics: [] },
          items: [],
        },
      });
    } finally {
      setIsLoading(false);
      setActiveAgentId(null);
    }
  }, [query, saveHistory]);

  const handleHistorySelect = useCallback((historyQuery: string) => {
    setQuery(historyQuery);
    setSidebarOpen(false);
    handleSearch(historyQuery);
  }, [handleSearch]);

  const handleClearHistory = useCallback(() => {
    setSearchHistory([]);
    saveHistory([]);
  }, [saveHistory]);

  const toggleFilter = useCallback((filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  }, []);

  const toggleSource = useCallback((index: number) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const parsedResult = searchResults?.result;
  const items = Array.isArray(parsedResult?.items) ? parsedResult.items : [];

  return (
    <div className="min-h-screen text-foreground">
      {/* History Sidebar */}
      <HistorySidebar
        history={searchHistory}
        onSelect={handleHistorySelect}
        onClear={handleClearHistory}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Document Upload Panel */}
      <DocumentUploadPanel isOpen={uploadPanelOpen} onClose={() => setUploadPanelOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-72">
        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-[16px] bg-white/60 border-b border-border/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-secondary transition-colors">
                <FiMenu className="w-5 h-5 text-foreground" />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <FiSearch className="w-4 h-4 text-primary-foreground" />
                </div>
                <h1 className="text-lg font-semibold text-foreground tracking-[-0.01em]">Knowledge Search</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground font-medium cursor-pointer">Sample Data</Label>
                <Switch id="sample-toggle" checked={sampleMode} onCheckedChange={setSampleMode} />
              </div>
              <button onClick={() => setUploadPanelOpen(true)} className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors" title="Upload Documents">
                <FiUpload className="w-4 h-4 text-primary" />
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">JD</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* Search Bar */}
          <div className="relative">
            <div className="relative group">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Ask anything about company knowledge..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading) {
                    handleSearch();
                  }
                }}
                className="w-full h-12 pl-12 pr-28 text-sm rounded-[0.875rem] backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/30 transition-all duration-200 placeholder:text-muted-foreground/60"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={isLoading || !query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-4 rounded-[0.625rem] text-xs font-medium"
              >
                {isLoading ? (
                  <FiLoader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <FiSearch className="w-3.5 h-3.5 mr-1.5" />
                    Search
                  </>
                )}
              </Button>
            </div>

            {/* Filter Chips */}
            <FilterChips activeFilters={activeFilters} onToggle={toggleFilter} />
          </div>

          {/* Content Area */}
          {isLoading ? (
            <LoadingSkeleton />
          ) : searchResults ? (
            <div className="space-y-6">
              {/* Answer Card */}
              {parsedResult && <AnswerCard result={parsedResult} />}

              {/* Source Cards */}
              {items.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <FiFileText className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground tracking-[-0.01em]">Sources ({items.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {items.map((item: any, index: number) => (
                      <SourceCard
                        key={item?.id ?? index}
                        item={item}
                        index={index}
                        isExpanded={expandedSources.has(index)}
                        onToggle={() => toggleSource(index)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState onSuggestionClick={(suggestion) => { setQuery(suggestion); handleSearch(suggestion); }} />
          )}

          {/* Agent Status */}
          <div className="mt-10">
            <AgentStatusCard isActive={!!activeAgentId} />
          </div>
        </main>
      </div>
    </div>
  );
}
