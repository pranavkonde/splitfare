"use client";

import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "./notification-item";
import { Button } from "@/components/ui/button";
import { CheckCheck, BellOff } from "lucide-react";

export function NotificationList() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground">
        <BellOff className="h-12 w-12 mb-4 opacity-20" />
        <h3 className="text-lg font-medium">No notifications yet</h3>
        <p className="text-sm">We&apos;ll let you know when something happens!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Notifications</h2>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 gap-2"
            onClick={markAllAsRead}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
