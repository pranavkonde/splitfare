"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { InviteShare } from "@/components/invite-share";
import { MemberList } from "@/components/member-list";
import { ExpenseList } from "@/components/expense-list";
import { BalanceView } from "@/components/balance-view";
import { BalanceSummary } from "@/components/balance-summary";
import { ActivityFeed } from "@/components/activity-feed";
import { QuickActions } from "@/components/quick-actions";
import { cn } from "@/lib/cn";
import { 
  Loader2, 
  ArrowLeft, 
  Settings, 
  Users, 
  Receipt, 
  Wallet,
  Calendar,
  Image as ImageIcon,
  History
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { toDbUserId } from "@/lib/privy-utils";
import { GroupDetailsSkeleton } from "@/components/loading-states/group-loading";

import { useSettlements } from "@/hooks/useSettlements";
import { useExpenses } from "@/hooks/useExpenses";

export default function GroupDetailsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { user: privyUser, getAccessToken } = usePrivy();
  const currentUserId = privyUser ? toDbUserId(privyUser.id) : "";
  const [activeTab, setActiveTab] = useState("expenses");

  const { data: group, isLoading: groupLoading, error } = useQuery({
    queryKey: ["group", id],
    queryFn: async () => {
      const token = await getAccessToken();
      if (token) {
        apiClient.setToken(token);
      }
      return apiClient.groups.get(id);
    },
    enabled: !!id && !!privyUser,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["group-members", id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/groups/${id}/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch members");
      return result.data;
    },
    enabled: !!id && !!privyUser,
  });

  const { settlements, isLoading: settlementsLoading } = useSettlements(id);
  const { data: expensesData, isLoading: expensesLoading } = useExpenses(id);

  const isLoading = groupLoading || membersLoading || settlementsLoading || expensesLoading;

  const currentUserBalance = members?.find((m: any) => m.user?.id === currentUserId)?.balance || 0;

  const activities = [
    ...(expensesData?.items || []).map((exp: any) => ({
      id: `exp-${exp.id}`,
      type: "expense" as const,
      content: `${exp.paidBy.name} added ${exp.description}`,
      timestamp: exp.created_at,
      user: exp.paidBy,
      amount: exp.total_amount,
      currency: exp.currency
    })),
    ...(settlements || []).map((s: any) => ({
      id: `settle-${s.id}`,
      type: "settlement" as const,
      content: `${s.payer.name} settled with ${s.payee.name}`,
      timestamp: s.created_at,
      user: s.payer,
      amount: s.amount,
      currency: s.currency
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (isLoading) {
    return <GroupDetailsSkeleton />;
  }

  if (error || !group) {
    return (
      <div className="container max-w-2xl py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold">Group not found</h1>
        <p className="text-muted-foreground">The group you're looking for doesn't exist or you don't have access.</p>
        <Button asChild>
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: "expenses", label: "Expenses", icon: <Receipt size={16} /> },
    { id: "balances", label: "Balances", icon: <Users size={16} /> },
    { id: "settle", label: "Settle", icon: <Wallet size={16} /> },
    { id: "activity", label: "Activity", icon: <History size={16} /> },
    { id: "media", label: "Media", icon: <ImageIcon size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/groups">
              <ArrowLeft size={20} />
            </Link>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-tighter">{group.name}</h1>
            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{group.category}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <Avatar key={i} className="h-7 w-7 border-2 border-background ring-1 ring-border" fallback="U" />
            ))}
          </div>
          <Button variant="ghost" size="icon">
            <Settings size={20} />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 space-y-6">
        <BalanceSummary netBalance={currentUserBalance} currency={group.currency} />
        
        <QuickActions groupId={id} />

        <div className="space-y-4">
          <div className="flex bg-muted/50 p-1 rounded-2xl overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all duration-300 flex-1 whitespace-nowrap",
                  activeTab === tab.id 
                    ? "bg-white dark:bg-slate-800 text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {activeTab === "expenses" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <ExpenseList groupId={id} currentUserId={currentUserId} />
              </div>
            )}
            {activeTab === "balances" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <BalanceView groupId={id} />
              </div>
            )}
            {activeTab === "settle" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {settlements && settlements.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Recent Settlements</h3>
                      <Badge variant="secondary" className="text-[10px] h-5 px-2 rounded-lg bg-emerald-500/10 text-emerald-500 border-none font-bold">
                        {settlements.length} total
                      </Badge>
                    </div>
                    <div className="grid gap-3">
                      {settlements.map((s: any) => (
                        <Card key={s.id} className="p-4 border-border/50 bg-card/50 rounded-2xl flex items-center justify-between group hover:bg-muted/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="flex -space-x-2">
                              <Avatar src={s.payer.avatar_url} fallback={s.payer.name.slice(0, 2).toUpperCase()} className="h-8 w-8 border-2 border-background" />
                              <Avatar src={s.payee.avatar_url} fallback={s.payee.name.slice(0, 2).toUpperCase()} className="h-8 w-8 border-2 border-background" />
                            </div>
                            <div>
                              <p className="text-sm font-bold tracking-tight">
                                {s.payer.id === currentUserId ? "You" : s.payer.name} paid {s.payee.id === currentUserId ? "you" : s.payee.name}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-emerald-500">
                              +{formatCurrency(s.amount)}
                            </p>
                            <Badge variant="outline" className="text-[8px] h-4 px-1 rounded-md opacity-40 uppercase font-black">
                              Completed
                            </Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Card className="p-12 text-center border-dashed bg-muted/30 rounded-3xl">
                    <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                      <Wallet className="h-8 w-8 text-emerald-500" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium italic">No settlements recorded yet.</p>
                    <Button variant="link" className="text-xs font-black uppercase tracking-tighter mt-2" asChild>
                      <Link href={`/groups/${id}?tab=balances`}>Settle a debt</Link>
                    </Button>
                  </Card>
                )}
              </div>
            )}
            {activeTab === "activity" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <ActivityFeed activities={activities} />
              </div>
            )}
            {activeTab === "media" && (
              <Card className="p-12 text-center border-dashed bg-muted/30 rounded-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-sm text-muted-foreground font-medium italic">Shared media and documents. Feature coming soon!</p>
              </Card>
            )}
          </div>
        </div>

        {group.invite_code && (
          <div className="pt-4">
            <InviteShare inviteCode={group.invite_code} groupName={group.name} />
          </div>
        )}
      </main>
    </div>
  );
}
