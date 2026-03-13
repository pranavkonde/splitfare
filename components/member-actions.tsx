"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { 
  UserPlus, 
  UserMinus, 
  ShieldCheck, 
  LogOut, 
  MoreHorizontal,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { useRouter } from "next/navigation";

type MemberActionsProps = {
  groupId: string;
  member: {
    user: {
      id: string;
      name: string;
    };
    role: string;
    balance: number;
  };
  currentUserRole: string;
  currentUserId: string;
  onUpdate: () => void;
  onOptimisticUpdate?: (userId: string, role: string) => void;
  onOptimisticRemove?: (userId: string) => void;
};

export function MemberActions({ 
  groupId, 
  member, 
  currentUserRole, 
  currentUserId,
  onUpdate,
  onOptimisticUpdate,
  onOptimisticRemove
}: MemberActionsProps) {
  const router = useRouter();
  const { notify } = useToast();
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
  const isOwner = currentUserRole === 'owner';
  const isSelf = member.user.id === currentUserId;

  const handleUpdateRole = async (newRole: string) => {
    if (onOptimisticUpdate) {
      onOptimisticUpdate(member.user.id, newRole);
      setIsPromoteModalOpen(false);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/members/${member.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error("Failed to update role");

      notify({
        title: "Success",
        description: `Member role updated to ${newRole}`,
        variant: "success",
      });
      setIsPromoteModalOpen(false);
      onUpdate();
    } catch (err) {
      notify({
        title: "Error",
        description: "Failed to update member role",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (onOptimisticRemove) {
      onOptimisticRemove(member.user.id);
      setIsRemoveModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/members/${member.user.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to remove member");

      notify({
        title: "Success",
        description: "Member removed from group",
        variant: "success",
      });
      setIsRemoveModalOpen(false);
      onUpdate();
    } catch (err) {
      notify({
        title: "Error",
        description: "Failed to remove member",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveGroup = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/members/leave`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to leave group");
      }

      notify({
        title: "Success",
        description: "You have left the group",
        variant: "success",
      });
      setIsLeaveModalOpen(false);
      router.push("/dashboard");
    } catch (err: any) {
      notify({
        title: "Error",
        description: err.message || "Failed to leave group",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSelf) {
    return (
      <>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-destructive hover:bg-destructive/10"
          onClick={() => setIsLeaveModalOpen(true)}
          disabled={currentUserRole === 'owner'}
          title={currentUserRole === 'owner' ? "Owner must transfer ownership before leaving" : "Leave Group"}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Leave
        </Button>

        <Modal
          open={isLeaveModalOpen}
          onOpenChange={setIsLeaveModalOpen}
          title="Leave Group?"
          description={`Are you sure you want to leave ${member.user.name}?`}
        >
          <div className="space-y-4 pt-4">
            {member.balance !== 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-500 uppercase tracking-wider">Unsettled Balance</p>
                  <p className="text-xs text-amber-200">
                    You have an unsettled balance of ${member.balance.toFixed(2)}. 
                    Please settle up before leaving for a smoother experience.
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsLeaveModalOpen(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleLeaveGroup} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave Group"}
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex items-center gap-1">
      {isOwner && member.role === 'member' && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsPromoteModalOpen(true)}
          title="Promote to Admin"
        >
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        </Button>
      )}

      {(isOwner || (isAdmin && member.role === 'member')) && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsRemoveModalOpen(true)}
          title="Remove Member"
        >
          <UserMinus className="h-4 w-4 text-destructive" />
        </Button>
      )}

      <Modal
        open={isPromoteModalOpen}
        onOpenChange={setIsPromoteModalOpen}
        title="Promote to Admin?"
        description={`Are you sure you want to promote ${member.user.name} to Admin?`}
      >
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => setIsPromoteModalOpen(false)}>Cancel</Button>
          <Button variant="default" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleUpdateRole('admin')} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Promote"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={isRemoveModalOpen}
        onOpenChange={setIsRemoveModalOpen}
        title="Remove Member?"
        description={`Are you sure you want to remove ${member.user.name} from the group?`}
      >
        <div className="space-y-4 pt-4">
          {member.balance !== 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-500 uppercase tracking-wider">Warning</p>
                <p className="text-xs text-amber-200">
                  This member has an unsettled balance of ${member.balance.toFixed(2)}.
                </p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsRemoveModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleRemoveMember} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove Member"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
