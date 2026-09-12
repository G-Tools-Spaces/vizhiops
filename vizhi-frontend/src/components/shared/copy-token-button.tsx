"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyTokenButton({ token }: { token: string }) {
  return (
    <Button
      aria-label="Copy token"
      size="icon"
      title="Copy token"
      onClick={() => {
        navigator.clipboard.writeText(token);
        toast.success("Token copied");
      }}
    >
      <Copy className="h-4 w-4" />
    </Button>
  );
}
