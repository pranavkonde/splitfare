"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Receipt, Search, SearchX } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { resolvePrivyAccessToken, SIGN_IN_REQUIRED } from "@/lib/privy-token";
import {
  fetchExpensesAcrossGroups,
  type CrossGroupExpenseRow,
} from "@/lib/cross-group-expenses";

function matchesQuery(haystack: string | null | undefined, q: string) {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(q);
}

type GroupLite = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  invite_code?: string | null;
  currency?: string | null;
};

type SearchExpenseRow = CrossGroupExpenseRow & {
  categoryDisplay: string;
};

function toTitleCase(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default function SearchPage() {
  const reduceMotion = useReducedMotion();
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [rawQuery, setRawQuery] = useState("");
  const q = rawQuery.trim().toLowerCase();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-search-corpus"],
    queryFn: async () => {
      const token = await resolvePrivyAccessToken(getAccessToken);
      if (!token) throw new Error(SIGN_IN_REQUIRED);

      const groupsRes = await fetch("/api/groups", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const groupsJson = await groupsRes.json();
      if (!groupsRes.ok || !groupsJson.success) {
        throw new Error(groupsJson?.error?.message || "Failed to load groups");
      }

      const groups = (groupsJson.data ?? []) as GroupLite[];
      const expenseRows = await fetchExpensesAcrossGroups(token, groups);

      const expenses: SearchExpenseRow[] = (expenseRows as CrossGroupExpenseRow[]).map((row) => ({
        ...row,
        categoryDisplay: toTitleCase(row.category),
      }));

      return { groups, expenses };
    },
    enabled: ready && authenticated,
    retry: false,
  });

  const matchedGroups = useMemo(() => {
    if (!q) return [];
    return (data?.groups ?? []).filter(
      (g) =>
        matchesQuery(g.name, q) ||
        matchesQuery(g.description, q) ||
        matchesQuery(g.category ? toTitleCase(g.category) : null, q) ||
        matchesQuery(g.invite_code, q)
    );
  }, [q, data?.groups]);

  const matchedExpenses = useMemo(() => {
    if (!q) return [];
    return (data?.expenses ?? []).filter(
      (e) =>
        matchesQuery(e.description, q) ||
        matchesQuery(e.groupName, q) ||
        matchesQuery(e.paidByName, q) ||
        matchesQuery(e.categoryDisplay, q) ||
        matchesQuery(e.category, q)
    );
  }, [q, data?.expenses]);

  const hasQuery = q.length > 0;
  const noMatches =
    hasQuery && matchedGroups.length === 0 && matchedExpenses.length === 0;

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
          <div className="h-10 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 text-center sm:px-6 sm:pt-8">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Sign in to search
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Search your groups and expenses after signing in.
          </p>
          <Button className="mt-5" onClick={() => login()}>
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl space-y-3 px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
          <div className="h-14 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (error) {
    const needsSignIn =
      error instanceof Error && error.message === SIGN_IN_REQUIRED;
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 text-center sm:px-6 sm:pt-8">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Could not load search
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {needsSignIn
              ? "Your session expired. Sign in again to continue."
              : "Please retry to refresh your data."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
            {needsSignIn && <Button onClick={() => login()}>Sign in</Button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        <header className="mb-6 space-y-6">
          <div className="space-y-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">Find</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Search
            </h1>
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              size={20}
              strokeWidth={2.5}
            />
            <input
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Groups, expenses, invite code…"
              className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </header>

        {!hasQuery ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-violet-400">
              <Search size={28} />
            </div>
            <p className="max-w-sm text-sm font-medium text-slate-500 dark:text-slate-400">
              Search by group name, description, category, invite code, expense
              title, or who paid.
            </p>
          </motion.div>
        ) : noMatches ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white py-20 dark:border-slate-600 dark:bg-slate-900/60"
          >
            <SearchX className="h-12 w-12 text-slate-400 dark:text-slate-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No matches
            </p>
            <p className="px-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Try another keyword or check spelling.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-8 pb-8">
            {matchedGroups.length > 0 && (
              <section className="space-y-3">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Groups
                </h2>
                <div className="space-y-2">
                  {matchedGroups.map((group, index) => (
                    <motion.div
                      key={group.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: reduceMotion ? 0 : index * 0.08,
                        duration: 0.3,
                      }}
                    >
                      <Link
                        href={`/groups/${group.id}`}
                        className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-violet-300/80 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-violet-500/30"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                          {group.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {group.name}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            {group.category ? (
                              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {toTitleCase(group.category)}
                              </span>
                            ) : null}
                            {group.description ? (
                              <span className="max-w-[200px] truncate text-xs text-slate-500 dark:text-slate-400">
                                {group.description}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {matchedExpenses.length > 0 && (
              <section className="space-y-3">
                <h2 className="px-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                  Expenses
                </h2>
                <div className="space-y-2">
                  {matchedExpenses.map((row, index) => (
                    <motion.div
                      key={`${row.groupId}-${row.id}`}
                      initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: reduceMotion ? 0 : index * 0.08,
                        duration: 0.3,
                      }}
                    >
                      <Link
                        href={`/groups/${row.groupId}/expenses/${row.id}`}
                        className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-violet-300/80 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-violet-500/30"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <Receipt size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {row.description}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {row.categoryDisplay}
                            </span>
                            <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {row.paidByName ? ` · ${row.paidByName}` : ""}
                              {" · "}
                              {row.groupName}
                            </span>
                          </div>
                        </div>
                        <p className="shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {Number(row.total_amount).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                            {row.currency}
                          </span>
                        </p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
