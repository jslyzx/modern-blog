"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function UiPreview({ className }: { className?: string }) {
  const [email, setEmail] = useState("");

  return (
    <div className={cn("flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm", className)}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor="email" className="text-sm font-medium">
          Subscribe for updates
        </label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Button type="submit" className="w-fit">
          Join newsletter
        </Button>
      </form>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-fit">
            Preview dialog
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thanks for stopping by</DialogTitle>
            <DialogDescription>
              This demo modal uses shadcn UI primitives styled with Tailwind CSS.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
            <Button type="button">Explore posts</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
