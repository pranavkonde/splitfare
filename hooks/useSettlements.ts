import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { toDbUserId } from "@/lib/privy-utils";

export function useSettlements(groupId: string) {
  const { getAccessToken, user: privyUser } = usePrivy();
  const queryClient = useQueryClient();
  const currentUserId = privyUser ? toDbUserId(privyUser.id) : "";

  const { data: settlements, isLoading, error } = useQuery({
    queryKey: ["settlements", groupId],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/settlements?groupId=${groupId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch settlements");
      return result.data;
    },
    enabled: !!groupId && !!privyUser,
  });

  const createSettlement = useMutation({
    mutationFn: async (data: { 
      from_user_id: string; 
      to_user_id: string; 
      amount: number; 
      transaction_hash?: string;
    }) => {
      const token = await getAccessToken();
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          group_id: groupId,
          ...data,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create settlement");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
  });

  return {
    settlements,
    isLoading,
    error,
    createSettlement,
    currentUserId,
  };
}
