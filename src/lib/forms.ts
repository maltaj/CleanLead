import { z } from "zod";

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Non-sensitive values echoed back after a failed submit. Never include passwords. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages?.[0]) result[key] = messages[0];
  }
  return result;
}

export function formString(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}
