import { GroupForm } from "@/components/group-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CreateGroupPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Create a Group</h1>
      </div>
      
      <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
        Groups help you track expenses with friends, family, or colleagues. 
        Once created, you&apos;ll get an invite code to share with others.
      </div>

      <GroupForm />
    </div>
  );
}
