"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Loader2, PackageCheck, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type StatusActionProps =
  | { target: "PROCESSING"; label: string; icon: typeof Play; destructive?: false }
  | { target: "READY"; label: string; icon: typeof Play; destructive?: false }
  | { target: "DISPATCHED"; label: string; icon: typeof Play; destructive?: false }
  | { target: "CANCELLED"; label: string; icon: typeof Play; destructive?: true };

const ACTIONS: Record<string, StatusActionProps[]> = {
  PENDING: [
    { target: "PROCESSING", label: "Start processing", icon: Play },
  ],
  PROCESSING: [{ target: "READY", label: "Mark ready", icon: PackageCheck }],
  READY: [{ target: "DISPATCHED", label: "Complete dispatch", icon: CheckCircle2 }],
};

const CANCELABLE: Record<string, boolean> = {
  PENDING: true,
  PROCESSING: true,
  READY: true,
  DISPATCHED: false,
  CANCELLED: false,
};

export function DispatchStatusActions({
  dispatchId,
  status,
}: {
  dispatchId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState<string | null>(null);
  const actions = ACTIONS[status] ?? [];

  async function run(target: string) {
    setLoading(target);
    try {
      const { updateDispatchStatusAction } = await import("./actions");
      const res = await updateDispatchStatusAction(dispatchId, target as never);
      if (!res.ok) throw new Error(res.error);
      toast.success(`Dispatch ${res.number} → ${target}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button key={action.target} onClick={() => run(action.target)} disabled={loading !== null}>
          {loading === action.target ? <Loader2 className="animate-spin" /> : <action.icon />}
          {action.label}
        </Button>
      ))}

      {CANCELABLE[status] && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={loading !== null} className="text-destructive hover:text-destructive">
              {loading === "CANCELLED" ? <Loader2 className="animate-spin" /> : <Ban />}
              Cancel dispatch
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this dispatch?</AlertDialogTitle>
              <AlertDialogDescription>
                Reserved stock will be released back to available inventory. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep dispatch</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  void run("CANCELLED");
                }}
              >
                Cancel dispatch
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
