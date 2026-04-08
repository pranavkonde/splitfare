"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  FileText, 
  Database, 
  ShieldCheck, 
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

export default function ExportPage() {
  const { id } = useParams();
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const [exporting, setExporting] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["group", id],
    queryFn: async () => {
      if (id === 'all') return { name: 'All Groups' };
      const token = await getAccessToken();
      const res = await fetch(`/api/groups/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch group");
      const json = await res.json();
      return json.data;
    },
  });

  const fetchHistory = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/groups/${id}/export/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const handleExport = async (format: string) => {
    setExporting(format);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/groups/${id}/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Export failed");

      if (format === 'car') {
        const json = await res.json();
        // Show root CID to user
        alert(`Export successful! Root CID: ${json.data.rootCid}\n\nYou can resolve this data at: ${json.data.url}`);
      } else if (format === 'csv') {
        const json = await res.json();
        const { expenses, settlements } = json.data;
        
        // Download expenses CSV
        const expBlob = new Blob([expenses], { type: 'text/csv' });
        const expUrl = window.URL.createObjectURL(expBlob);
        const expA = document.createElement('a');
        expA.href = expUrl;
        expA.download = `group_${id}_expenses.csv`;
        expA.click();
        window.URL.revokeObjectURL(expUrl);

        // Download settlements CSV
        const setBlob = new Blob([settlements], { type: 'text/csv' });
        const setUrl = window.URL.createObjectURL(setBlob);
        const setA = document.createElement('a');
        setA.href = setUrl;
        setA.download = `group_${id}_settlements.csv`;
        setA.click();
        window.URL.revokeObjectURL(setUrl);
      } else {
        // Handle PDF/JSON download
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const extension = format === 'pdf' ? 'pdf' : 'json';
        a.download = `group_${id}_export.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
      
      void fetchHistory();
    } catch (error) {
      console.error("Export error", error);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const exportFormats = [
    {
      id: "car",
      name: "Storacha Archive",
      description: "IPLD CAR file with root CID for independent cryptographic resolution.",
      icon: Database,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      id: "json",
      name: "JSON Export",
      description: "Complete structured data with all CID references for developers.",
      icon: FileJson,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      id: "csv",
      name: "CSV Spreadsheets",
      description: "Separate files for expenses and settlements, formatted for accounting.",
      icon: FileSpreadsheet,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      id: "pdf",
      name: "PDF Report",
      description: "Formatted summary with receipt thumbnails and settlement records.",
      icon: FileText,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl border-2 border-slate-900">
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Export Group Data</h1>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">{group?.name || "Loading..."}</p>
            </div>
          </div>
          {id !== 'all' && (
            <Button variant="outline" className="border-slate-800 hover:bg-slate-900" onClick={() => router.push('/groups/all/export')}>
              Export All Groups
            </Button>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm md:col-span-2 border-2 border-dashed">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="text-emerald-500" size={24} />
              </div>
              <div>
                <h3 className="font-black uppercase text-sm tracking-tight">Reclaim Your Data</h3>
                <p className="text-slate-400 text-xs font-medium">
                  Your data, your storage. We believe in data sovereignty. Export your group history in content-addressable formats that you can host and verify independently.
                </p>
              </div>
            </CardContent>
          </Card>

          {exportFormats.map((format) => (
            <Card key={format.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all">
              <CardHeader>
                <div className={`h-12 w-12 rounded-xl ${format.bg} flex items-center justify-center mb-2`}>
                  <format.icon className={format.color} size={24} />
                </div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">{format.name}</CardTitle>
                <CardDescription className="text-slate-500 text-xs font-medium leading-relaxed">
                  {format.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full bg-slate-50 text-slate-950 font-black uppercase tracking-wider hover:bg-slate-200"
                  onClick={() => handleExport(format.id)}
                  disabled={exporting !== null}
                >
                  {exporting === format.id ? (
                    <Clock className="mr-2 animate-spin" size={16} />
                  ) : (
                    <Download className="mr-2" size={16} />
                  )}
                  {exporting === format.id ? "Generating..." : "Export"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <History size={20} className="text-slate-500" />
            <h2 className="text-lg font-black uppercase tracking-tight">Export History</h2>
          </div>
          
          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden">
            {history.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No export history yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {history.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        item.status === 'completed' ? 'bg-emerald-500/10' : 
                        item.status === 'failed' ? 'bg-rose-500/10' : 'bg-blue-500/10'
                      }`}>
                        {item.status === 'completed' ? <CheckCircle2 size={16} className="text-emerald-500" /> :
                         item.status === 'failed' ? <AlertCircle size={16} className="text-rose-500" /> :
                         <Clock size={16} className="text-blue-500 animate-pulse" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black uppercase text-xs tracking-tight">{item.format} Export</span>
                          <Badge variant="outline" className="text-[8px] uppercase font-black px-1.5 py-0 border-slate-700">
                            {item.status}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {item.root_cid && (
                      <Link 
                        href={`https://w3s.link/ipfs/${item.root_cid}`} 
                        target="_blank"
                        className="text-slate-400 hover:text-slate-50 transition-colors"
                      >
                        <ExternalLink size={16} />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
