"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { toDbUserId } from "@/lib/privy-utils";
import { ExpenseDetail } from "@/components/expense-detail";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

function paramToString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function ExpenseDetailPage() {
  const params = useParams();
  const groupId = paramToString(params.id);
  const expenseId = paramToString(params.expenseId);
  const router = useRouter();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { user: privyUser, getAccessToken } = usePrivy();
  const currentUserId = privyUser ? toDbUserId(privyUser.id) : "";

  const { data: expense, isLoading, error } = useQuery({
    queryKey: ["expense", groupId, expenseId],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/groups/${groupId}/expenses/${expenseId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (!res.ok) {
        const msg =
          typeof result?.error === "string"
            ? result.error
            : result?.error?.message ?? result?.data?.error ?? "Failed to fetch expense";
        throw new Error(msg);
      }
      return result.data;
    },
    enabled: !!groupId && !!expenseId && !!privyUser,
  });

  const { data: membership } = useQuery({
    queryKey: ["group-membership", groupId],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/groups/${groupId}/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch membership");
      return result.data.find((m: any) => m.user.id === currentUserId);
    },
    enabled: !!groupId && !!privyUser,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/groups/${groupId}/expenses/${expenseId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to delete expense");
      }
    },
    onSuccess: () => {
      notify({
        title: "Deleted",
        description: "Expense has been removed successfully.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      router.push(`/groups/${groupId}`);
    },
    onError: (err: Error) => {
      notify({
        title: "Error",
        description: err.message,
        variant: "error",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="text-center space-y-4">
          <Skeleton className="h-20 w-20 rounded-3xl mx-auto" />
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-20 w-48 mx-auto" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-20 text-center space-y-4">
        <div className="flex justify-center">
          <AlertCircle className="h-12 w-12 text-rose-500 opacity-20" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter">Expense Not Found</h1>
        <p className="text-sm text-muted-foreground font-medium px-10">
          The expense you are looking for might have been deleted or you don&apos;t have access to view it.
        </p>
        <Button asChild variant="outline" className="rounded-2xl font-black uppercase tracking-tighter mt-4">
          <Link href={`/groups/${groupId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Group
          </Link>
        </Button>
      </div>
    );
  }

  const canManage = expense.paidBy.id === currentUserId || membership?.role === 'admin' || membership?.role === 'owner';

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/80 px-4 backdrop-blur-md">
        <Button variant="ghost" size="icon" asChild className="mr-4 rounded-full">
          <Link href={`/groups/${groupId}`}>
            <ArrowLeft size={20} />
          </Link>
        </Button>
        <h1 className="text-sm font-black uppercase tracking-tighter">Expense Details</h1>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 p-4 py-8">
        <ExpenseDetail 
          expense={expense}
          currentUserId={currentUserId}
          canManage={canManage}
          onDelete={() => {
            if (confirm("Are you sure you want to delete this expense?")) {
              deleteMutation.mutate();
            }
          }}
          onEdit={() => {
            notify({ title: "Coming Soon", description: "Edit functionality will be available in the next update." });
          }}
          onSettle={() => {
            router.push(`/groups/${groupId}/settle?expenseId=${expenseId}`);
          }}
        />
      </main>
    </div>
  );
}
