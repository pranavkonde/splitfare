"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useSettlements } from "@/hooks/useSettlements";
import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { toDbUserId } from "@/lib/privy-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, Wallet, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/currency";

export default function SettlePage({ params }: { params: { id: string } }) {
  const { id: groupId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useToast();
  const { getAccessToken, user: privyUser } = usePrivy();
  const currentUserId = privyUser ? toDbUserId(privyUser.id) : "";
  
  const toUserId = searchParams.get("to");
  const initialAmount = searchParams.get("amount");
  
  const [amount, setAmount] = useState(initialAmount || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createSettlement } = useSettlements(groupId);

  const { data: members } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/groups/${groupId}/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch members");
      return result.data;
    },
    enabled: !!groupId && !!privyUser,
  });

  const payee = members?.find((m: any) => m.user?.id === toUserId)?.user;
  const payer = members?.find((m: any) => m.user?.id === currentUserId)?.user;

  const handleSettle = async () => {
    if (!toUserId || !amount || isNaN(Number(amount))) {
      notify({
        title: "Error",
        description: "Please enter a valid amount and recipient",
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createSettlement.mutateAsync({
        from_user_id: currentUserId,
        to_user_id: toUserId,
        amount: Number(amount),
      });

      notify({
        title: "Success",
        description: `Settled ${formatCurrency(Number(amount))} with ${payee?.name}`,
        variant: "success",
      });
      router.push(`/groups/${groupId}?tab=balances`);
    } catch (err: any) {
      notify({
        title: "Error",
        description: err.message || "Failed to create settlement",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!payee) {
    return (
      <div className="container max-w-2xl py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold">Recipient not found</h1>
        <Button asChild variant="outline">
          <Link href={`/groups/${groupId}`}>Back to Group</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md px-4 h-16 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href={`/groups/${groupId}?tab=balances`}>
            <ArrowLeft size={20} />
          </Link>
        </Button>
        <h1 className="text-lg font-black uppercase tracking-tighter">Record Settlement</h1>
      </header>

      <main className="mx-auto max-w-md p-4 space-y-8 pt-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <Avatar src={payer?.avatar_url || undefined} fallback={payer?.name?.slice(0, 2).toUpperCase() || "ME"} className="h-16 w-16 border-2 border-primary/20 shadow-lg" />
              <span className="text-xs font-bold uppercase opacity-60">You</span>
            </div>
            <div className="h-px w-12 bg-border relative">
              <ArrowRight className="h-4 w-4 text-muted-foreground absolute right-0 top-1/2 -translate-y-1/2" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar src={payee?.avatar_url || undefined} fallback={payee?.name?.slice(0, 2).toUpperCase()} className="h-16 w-16 border-2 border-emerald-500/20 shadow-lg" />
              <span className="text-xs font-bold uppercase opacity-60">{payee?.name}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-tighter">Settling Up</h2>
            <p className="text-sm text-muted-foreground px-8 leading-relaxed">
              Recording a payment from you to {payee?.name}. This will update your balances in the group.
            </p>
          </div>
        </div>

        <Card className="p-8 space-y-6 border-none bg-muted/30 rounded-[2.5rem] shadow-sm">
          <div className="space-y-4 text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Amount Paid</span>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black opacity-30">USDC</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-20 text-4xl font-black text-center border-none bg-white dark:bg-slate-900 rounded-3xl shadow-inner focus-visible:ring-primary/20"
                autoFocus
              />
            </div>
          </div>

          <Button 
            className="w-full h-16 rounded-3xl text-lg font-black uppercase tracking-tighter gap-3 shadow-xl shadow-emerald-500/10"
            onClick={handleSettle}
            disabled={isSubmitting || !amount}
          >
            {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Wallet className="h-6 w-6" />}
            Confirm Settlement
          </Button>
        </Card>

        <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold px-12 leading-relaxed opacity-60">
          This record is for tracking purposes. Ensure the actual funds have been transferred.
        </p>
      </main>
    </div>
  );
}
