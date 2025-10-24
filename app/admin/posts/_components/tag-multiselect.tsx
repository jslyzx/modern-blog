"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const normalizeTag = (value: string) => value.trim().toLowerCase();

export function TagMultiSelect({
  value,
  onChange,
  placeholder = "Add a tag and press Enter",
  maxTags = 20,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}) {
  const [inputValue, setInputValue] = useState("");

  const addTag = (tag: string) => {
    const normalized = normalizeTag(tag);

    if (!normalized || value.includes(normalized) || value.length >= maxTags) {
      return;
    }

    onChange([...value, normalized]);
    setInputValue("");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <Badge key={tag} className="gap-1 bg-primary/10 text-primary">
            <span>{tag}</span>
            <button
              type="button"
              className="rounded-full bg-primary/20 px-1 text-[10px] uppercase tracking-wide"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </Badge>
        ))}
        {value.length === 0 && <span className="text-xs text-muted-foreground">No tags selected</span>}
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (inputValue.trim()) {
                addTag(inputValue);
              }
            }

            if (event.key === ",") {
              event.preventDefault();
              if (inputValue.trim()) {
                addTag(inputValue);
              }
            }
          }}
        />
        <Button type="submit" variant="outline" disabled={!inputValue.trim() || value.length >= maxTags}>
          Add
        </Button>
      </form>
    </div>
  );
}
