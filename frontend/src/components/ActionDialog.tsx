import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  fieldLabel,
  placeholder,
  required = false,
  confirmLabel,
  confirmClassName,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fieldLabel: string;
  placeholder?: string;
  required?: boolean;
  confirmLabel: string;
  confirmClassName?: string;
  pending?: boolean;
  onConfirm: (text: string) => void;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText("");
  }, [open]);
  const invalid = required && !text.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="action-text">
            {fieldLabel}
            {required ? (
              <span className="text-destructive">*</span>
            ) : (
              <span className="font-normal text-muted-foreground">(optional)</span>
            )}
          </Label>
          <Textarea
            id="action-text"
            rows={4}
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Saved to the record and the audit log.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={confirmClassName}
            disabled={invalid || pending}
            onClick={() => onConfirm(text.trim())}
          >
            {pending ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
