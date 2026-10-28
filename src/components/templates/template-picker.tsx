"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { renderTemplate, unknownFields, type TemplateVars } from "@/lib/templates/render";
import { whatsappLink } from "@/lib/templates/whatsapp";

export function TemplatePicker({
  templates,
  vars,
  phone,
  manageHref,
}: {
  templates: { id: string; name: string; body: string }[];
  vars: TemplateVars;
  phone: string | null;
  manageHref: string;
}) {
  const [templateId, setTemplateId] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  const selected = templates.find((t) => t.id === templateId);
  const missing = useMemo(() => (selected ? unknownFields(selected.body) : []), [selected]);
  const wa = whatsappLink(phone, text);

  function choose(id: string) {
    setTemplateId(id);
    setCopied("idle");
    const t = templates.find((x) => x.id === id);
    setText(t ? renderTemplate(t.body, vars) : "");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  if (templates.length === 0) {
    return (
      <p className="text-muted text-sm">
        No message templates yet.{" "}
        <a href={manageHref} className="text-brand hover:underline">
          Add some
        </a>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="template" className="text-sm font-medium">
          Template
        </label>
        <Select id="template" value={templateId} onChange={(e) => choose(e.target.value)}>
          <option value="">Choose a template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {selected ? (
        <>
          {missing.length > 0 ? (
            <p className="text-danger text-xs">
              Unknown placeholder{missing.length > 1 ? "s" : ""}:{" "}
              {missing.map((m) => `{{${m}}}`).join(", ")}. Edit the template or the text below
              before sending.
            </p>
          ) : null}
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCopied("idle");
            }}
            className="min-h-36"
            aria-label="Message text"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copy} className="flex-1">
              {copied === "copied" ? "Copied" : "Copy message"}
            </Button>
            {wa ? (
              <Button asChild variant="secondary" className="flex-1">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  Open in WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
          {copied === "failed" ? (
            <p className="text-danger text-xs">
              Couldn&apos;t copy automatically. Select the text and copy it.
            </p>
          ) : null}
          {!wa ? (
            <p className="text-muted text-xs">
              Add a phone number to this lead to get a WhatsApp link.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
