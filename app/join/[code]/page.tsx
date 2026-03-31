"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Users, Loader2, ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

type GroupPreview = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  avatar_url: string | null;
  member_count: number;
};

export default function JoinGroupPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const { code } = params;
  const { authenticated, login, getAccessToken } = usePrivy();
  const { notify } = useToast();

  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGroup() {
      try {
        const res = await fetch(`/api/groups/invite/${code}`);
        const result = await res.json();

        if (!res.ok) {
          const msg =
            typeof result.error === "object" && result.error?.message
              ? result.error.message
              : typeof result.error === "string"
                ? result.error
                : "Failed to load group details";
          setError(msg);
        } else {
          setGroup(result.data);
        }
      } catch (err) {
        setError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchGroup();
  }, [code]);

  const handleJoin = async () => {
    if (!authenticated) {
      login();
      return;
    }

    setIsJoining(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/groups/invite/${code}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await res.json();

      if (res.ok) {
        notify({
          title: "Joined!",
          description: `You are now a member of ${group?.name}`,
          variant: "success",
        });
        router.push(`/dashboard/groups/${result.data.groupId}`);
      } else {
        const err = result.error;
        const errMessage = typeof err === "object" && err?.message ? err.message : typeof err === "string" ? err : "";
        const errCode = typeof err === "object" ? err.code : undefined;
        const groupIdFromErr = typeof err === "object" && err?.details?.groupId ? err.details.groupId : undefined;

        if (errMessage === "Already a member" || errCode === "ALREADY_MEMBER") {
          notify({
            title: "Already a member",
            description: "You are already in this group.",
          });
          if (groupIdFromErr) {
            router.push(`/dashboard/groups/${groupIdFromErr}`);
          }
        } else {
          notify({
            title: "Error joining group",
            description: errMessage || "Please try again later.",
            variant: "error",
          });
        }
      }
    } catch (err) {
      notify({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "error",
      });
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-background">
        <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative container max-w-md py-12 space-y-6">
        <div className="absolute -top-2 right-4 z-10 sm:right-6">
          <ThemeToggle />
        </div>
        <Card className="p-8 text-center space-y-4 border-destructive/20 bg-destructive/5">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">Invalid Invite</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative container max-w-md py-12 space-y-6">
      <div className="absolute top-4 right-4 z-10 sm:right-6">
        <ThemeToggle />
      </div>
      <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Dashboard
      </Link>

      <Card className="overflow-hidden">
        <div className="bg-primary/10 p-8 flex flex-col items-center justify-center space-y-4">
          <div className="h-20 w-20 rounded-3xl bg-primary flex items-center justify-center text-primary-foreground text-4xl font-bold shadow-xl">
            {group?.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{group?.name}</h1>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="uppercase text-[10px]">
                {group?.category}
              </Badge>
              <div className="flex items-center text-xs text-muted-foreground">
                <Users className="h-3 w-3 mr-1" />
                {group?.member_count} members
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {group?.description && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">About</h2>
              <p className="text-sm">{group.description}</p>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleJoin}
              disabled={isJoining}
            >
              {isJoining ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : authenticated ? (
                "Join Group"
              ) : (
                "Log in to Join"
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              By joining, you agree to share your profile with other members.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
