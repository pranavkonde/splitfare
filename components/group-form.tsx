"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateGroupSchema, GroupCategoryEnum } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { uploadReceipt } from "@/services/receipt-upload";
import { resolveMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/cn";
import { z } from "zod";
import { usePrivy } from "@privy-io/react-auth";
import { apiClient } from "@/lib/api-client";
import type { CreateGroup } from "@/lib/validations";

type FormData = z.input<typeof CreateGroupSchema>;

export function GroupForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { ready, getAccessToken } = usePrivy();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(CreateGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "other",
      currency: "USDC",
    },
  });

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!ready) {
      notify({
        title: "One moment",
        description: "Still connecting your session. Try again in a second.",
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let token = await getAccessToken();
      if (!token && typeof window !== "undefined") {
        token = sessionStorage.getItem("api_token");
      }
      if (!token) {
        notify({
          title: "Sign in required",
          description: "Refresh the page or sign in again to create a group.",
          variant: "error",
        });
        return;
      }

      apiClient.setToken(token);

      let avatarUrl: string | null = null;

      if (avatarFile) {
        const cid = await uploadReceipt(avatarFile, () => {}, getAccessToken);
        avatarUrl = resolveMediaUrl(cid);
      }

      const payload: CreateGroup = {
        name: data.name,
        description: data.description || null,
        category: data.category as "event" | "trip" | "household" | "project" | "other",
        currency: data.currency ?? "USDC",
        avatar_url: avatarUrl,
      };

      const group = await apiClient.groups.create(payload);

      notify({
        title: "Success",
        description: "Group created successfully!",
        variant: "success",
      });

      if (group?.id) {
        await queryClient.invalidateQueries({ queryKey: ["groups"] });
        await queryClient.invalidateQueries({ queryKey: ["group", group.id] });
        router.push(`/groups/${group.id}`);
      }
    } catch (error) {
      console.error("Error creating group:", error);
      notify({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold">Create New Group</h2>
      </div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Group Name</label>
            <Input
              {...register("name")}
              placeholder="e.g. Summer Trip 2024"
              className={cn(errors.name && "border-destructive")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description (Optional)</label>
            <Input
              {...register("description")}
              placeholder="What's this group about?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <select
              {...register("category")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {GroupCategoryEnum.options.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Group Avatar</label>
            <div className="flex items-center space-x-4">
              {avatarPreview && (
                <div className="relative w-12 h-12 rounded-full overflow-hidden border">
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={onAvatarChange}
                className="cursor-pointer"
              />
            </div>
          </div>
        </div>
        <div className="p-6 pt-0">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Group"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
