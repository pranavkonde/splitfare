"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { InviteShare } from "@/components/invite-share";
import { ExpenseList } from "@/components/expense-list";
import { BalanceView } from "@/components/balance-view";
import { BalanceSummary } from "@/components/balance-summary";
import { QuickActions } from "@/components/quick-actions";
import { cn } from "@/lib/cn";
import {
  ArrowLeft,
  Settings,
  Receipt,
  Wallet,
  Image as ImageIcon,
  History,
  Download,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { toDbUserId } from "@/lib/privy-utils";
import {
  resolvePrivyAccessToken,
  SIGN_IN_REQUIRED,
} from "@/lib/privy-token";
import { GroupDetailsSkeleton } from "@/components/loading-states/group-loading";
import { SettleView } from "@/components/settle-view";
import { GroupExport } from "@/components/group-export";
import { ShieldCheck } from "lucide-react";

import { MediaGrid } from "@/components/media-grid";
import { MediaUpload } from "@/components/media-upload";

function paramToString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function GroupDetailsPage() {
  const params = useParams();
  const id = paramToString(params.id);
  const { ready, authenticated, login, user: privyUser, getAccessToken } =
    usePrivy();
  const currentUserId = privyUser ? toDbUserId(privyUser.id) : "";
  const [activeTab, setActiveTab] = useState("expenses");

  const {
    data: group,
    isLoading: groupLoading,
    error,
    refetch: refetchGroup,
  } = useQuery({
    queryKey: ["group", id],
    queryFn: async () => {
      const token = await resolvePrivyAccessToken(getAccessToken);
      if (!token) {
        throw new Error(SIGN_IN_REQUIRED);
      }
      apiClient.setToken(token);
      const g = await apiClient.groups.get(id as string);
      if (
        g &&
        typeof g === "object" &&
        "error" in g &&
        !("name" in (g as Record<string, unknown>))
      ) {
        return null;
      }
      return g;
    },
    enabled: !!id && ready && authenticated,
    retry: (_, err) =>
      err instanceof Error && err.message === SIGN_IN_REQUIRED ? false : true,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["group-members", id],
    queryFn: async () => {
      const token = await resolvePrivyAccessToken(getAccessToken);
      if (!token) {
        throw new Error(SIGN_IN_REQUIRED);
      }
      const res = await fetch(`/api/groups/${id as string}/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (!res.ok || result.success === false) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : result.error?.message ?? "Failed to fetch members";
        throw new Error(msg);
      }
      return result.data;
    },
    enabled: !!id && ready && authenticated,
    retry: (_, err) =>
      err instanceof Error && err.message === SIGN_IN_REQUIRED ? false : true,
  });

  const isLoading = groupLoading || membersLoading;

  if (!id) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12 text-center sm:px-6 space-y-4">
        <h1 className="text-2xl font-bold">Invalid group link</h1>
        <p className="text-muted-foreground">This URL is missing a group id.</p>
        <Button asChild>
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  if (ready && !authenticated) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-12 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Sign in to view this group
        </h1>
        <p className="mx-auto max-w-md text-slate-600 dark:text-slate-400">
          Open your account to load group details and balances.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500"
            onClick={() => login()}
          >
            Sign in
          </Button>
          <Button variant="outline" asChild>
            <Link href="/groups">Back to groups</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentUserBalance = members?.find((m: any) => m.user?.id === currentUserId)?.balance || 0;
  const isAdmin = members?.find((m: any) => m.user?.id === currentUserId)?.role === 'admin';

  const activities = [
    {
      id: "1",
      type: "expense" as const,
      content: "Alice added Dinner in SoHo",
      timestamp: new Date().toISOString(),
      user: { name: "Alice", avatar_url: null },
      amount: 132.40,
      currency: "USDC"
    },
    {
      id: "2",
      type: "join" as const,
      content: "Bob joined the group",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      user: { name: "Bob", avatar_url: null }
    }
  ];

  if (isLoading) {
    return <GroupDetailsSkeleton />;
  }

  if (error instanceof Error && error.message === SIGN_IN_REQUIRED) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-12 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Session refresh needed
        </h1>
        <p className="mx-auto max-w-md text-slate-600 dark:text-slate-400">
          We could not get a valid session token. Try signing in again, or go
          home and reopen the app.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => void refetchGroup()}>
            Retry
          </Button>
          <Button onClick={() => login()}>Sign in again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12 text-center sm:px-6 space-y-4">
        <h1 className="text-2xl font-bold">Group not found</h1>
        <p className="text-muted-foreground">The group you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.</p>
        <Button asChild>
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: "expenses", label: "Expenses", icon: <Receipt size={16} /> },
    { id: "balances", label: "Balances", icon: <History size={16} /> },
    { id: "settle", label: "Settle", icon: <Wallet size={16} /> },
    { id: "media", label: "Media", icon: <ImageIcon size={16} /> },
    { id: "export", label: "Export", icon: <Download size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-32 dark:bg-slate-950">
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b-2 border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-900 dark:bg-slate-950/80">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl border-2 border-transparent transition-all hover:border-slate-200 hover:bg-slate-100 dark:hover:border-slate-800 dark:hover:bg-slate-900" asChild>
            <Link href="/dashboard">
              <ArrowLeft size={20} className="stroke-[3]" />
            </Link>
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black uppercase leading-none tracking-tight text-slate-900 dark:text-slate-50">{group.name}</h1>
              <Link href={`/groups/${id}/verify`} className="flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 transition-all hover:bg-emerald-500/20 dark:text-emerald-400">
                <ShieldCheck size={10} className="stroke-[3]" />
                <span className="text-[8px] font-black uppercase tracking-widest">Verified</span>
              </Link>
            </div>
            <span className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 opacity-70 dark:text-slate-500 dark:opacity-40">{group.category}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
            {members?.slice(0, 3).map((m: any, i: number) => (
              <Avatar 
                key={i} 
                src={m.user?.avatar_url} 
                className="h-9 w-9 border-2 border-white shadow-brutalist-sm ring-1 ring-slate-200 dark:border-slate-950 dark:ring-slate-800" 
                fallback={m.user?.name?.slice(0, 1).toUpperCase()} 
              />
            ))}
            {members && members.length > 3 && (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-black text-slate-600 shadow-brutalist-sm dark:border-slate-950 dark:bg-slate-900 dark:text-slate-500">
                +{members.length - 3}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl border-2 border-transparent transition-all hover:border-slate-200 hover:bg-slate-100 dark:hover:border-slate-800 dark:hover:bg-slate-900">
            <Settings size={20} className="stroke-[3]" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-12 px-4 py-8 sm:space-y-14 sm:px-6 lg:px-8">
        <BalanceSummary netBalance={currentUserBalance} currency={group.currency || "USDC"} />
        
        <QuickActions groupId={id} />

        <div className="space-y-7">
          <div className="flex overflow-x-auto rounded-2xl border-2 border-slate-200 bg-slate-100 p-1.5 shadow-brutalist-sm no-scrollbar dark:border-slate-800 dark:bg-slate-900">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all duration-300 sm:px-4",
                  activeTab === tab.id 
                    ? "border-2 border-slate-900/10 bg-brand-pink text-slate-950 shadow-brutalist-sm dark:border-slate-950/10" 
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-300"
                )}
              >
                {React.cloneElement(tab.icon as React.ReactElement, { 
                  className: cn("stroke-[3]", activeTab === tab.id ? "text-slate-950" : "text-slate-600 dark:text-slate-500") 
                })}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-2">
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
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <SettleView groupId={id} />
              </div>
            )}
            {activeTab === "media" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-50">Shared Media</h2>
                  <MediaUpload groupId={id} />
                </div>
                <MediaGrid groupId={id} isAdmin={isAdmin} />
              </div>
            )}
            {activeTab === "export" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <GroupExport groupId={id} />
              </div>
            )}
          </div>
        </div>

        {group.invite_code && (
          <div className="pt-6">
            <InviteShare inviteCode={group.invite_code} groupName={group.name} />
          </div>
        )}
      </main>
    </div>
  );
}
