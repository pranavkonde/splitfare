"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { CATEGORIES } from "@/lib/validations/expense";
import {
  Tag, Utensils, Car, Home, Zap, Plane, Calendar,
  Clock, Receipt, ExternalLink, Copy,
  Check, Edit2, Trash2, Wallet,
  ChevronRight, ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/cn";
import { format } from "date-fns";
import { SplitBreakdown } from "./split-breakdown";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import { resolveMediaUrl } from "@/lib/media-url";

const categoryIcons: Record<string, typeof Tag> = {
  other: Tag,
  food: Utensils,
  transport: Car,
  accommodation: Home,
  travel: Plane,
  subscription: Zap,
};

interface ExpenseDetailProps {
  expense: {
    id: string;
    description: string;
    total_amount: number;
    category: string;
    created_at: string;
    paidBy: {
      id: string;
      name: string;
      avatar_url: string | null;
    };
    splits: any[];
    receipts?: Array<{
      cid: string;
      media_type: string;
    }>;
  };
  currentUserId: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onSettle?: () => void;
  canManage?: boolean;
}

export function ExpenseDetail({ 
  expense, 
  currentUserId, 
  onEdit, 
  onDelete, 
  onSettle,
  canManage 
}: ExpenseDetailProps) {
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);
  const category = CATEGORIES.find(c => c.id === expense.category);
  const Icon = categoryIcons[expense.category] || Tag;
  const receipt = expense.receipts?.[0];

  const copyCid = () => {
    if (receipt?.cid) {
      navigator.clipboard.writeText(receipt.cid);
      setCopied(true);
      notify({ title: "Copied", description: "CID copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const userSplit = expense.splits.find(s => s.user_id === currentUserId);
  const needsSettlement = userSplit && !userSplit.is_settled && expense.paidBy.id !== currentUserId;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Amount */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-3xl mb-2">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">
            {expense.description}
          </h2>
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest opacity-60">
            {category?.name || "General"}
          </Badge>
        </div>
        <div className="py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-1">Total Amount</p>
          <p className="text-5xl font-black tracking-tighter text-primary">
            {formatCurrency(Number(expense.total_amount))}
          </p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-muted/30 border-border/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Date
          </p>
          <p className="text-sm font-bold">
            {format(new Date(expense.created_at), "MMM d, yyyy")}
          </p>
          <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
            {format(new Date(expense.created_at), "h:mm a")}
          </p>
        </Card>

        <Card className="p-4 bg-muted/30 border-border/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <Wallet className="h-3 w-3" /> Paid By
          </p>
          <div className="flex items-center gap-2">
            <Avatar 
              src={expense.paidBy.avatar_url || undefined} 
              fallback={expense.paidBy.name.slice(0, 2).toUpperCase()}
              className="h-6 w-6"
            />
            <span className="text-sm font-bold truncate">
              {expense.paidBy.id === currentUserId ? "You" : expense.paidBy.name}
            </span>
          </div>
        </Card>
      </div>

      {/* Splits */}
      <SplitBreakdown 
        splits={expense.splits} 
        totalAmount={expense.total_amount} 
      />

      {/* Receipt Section */}
      {receipt && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">
            Receipt Proof
          </h3>
          <Card className="p-4 bg-muted/30 border-border/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold">Digital Receipt</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {receipt.cid.slice(0, 8)}...{receipt.cid.slice(-8)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={copyCid}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" asChild>
                  <a href={resolveMediaUrl(receipt.cid)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
            
            <Link 
              href={resolveMediaUrl(receipt.cid)}
              target="_blank"
              className="block relative aspect-video rounded-2xl overflow-hidden border bg-background group"
            >
              <img 
                src={resolveMediaUrl(receipt.cid)} 
                alt="Receipt thumbnail"
                className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  View Full Receipt <ArrowUpRight className="h-4 w-4" />
                </p>
              </div>
            </Link>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="pt-4 space-y-3">
        {needsSettlement && (
          <Button 
            className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-tighter gap-3 shadow-lg shadow-primary/20"
            onClick={onSettle}
          >
            <Wallet className="h-5 w-5" />
            Settle My Share
          </Button>
        )}

        {canManage && (
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-2xl font-black uppercase tracking-tighter gap-2"
              onClick={onEdit}
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-2xl font-black uppercase tracking-tighter gap-2 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 border-rose-500/20"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Activity Log (Mock for now) */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">
          Activity History
        </h3>
        <div className="space-y-4 px-1">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-2 w-2 rounded-full bg-primary ring-4 ring-primary/10" />
              <div className="w-px flex-1 bg-border mt-2" />
            </div>
            <div className="pb-4">
              <p className="text-xs font-bold leading-none">Expense Created</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {format(new Date(expense.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
          {receipt && (
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
              </div>
              <div>
                <p className="text-xs font-bold leading-none">Receipt Verified on IPFS</p>
                <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                  CID: {receipt.cid.slice(0, 12)}...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
