import { NextResponse } from "next/server";
import {
  generateCharacter,
  generateLook,
  sanitizeSpec,
  serverErrorToMessage,
} from "@/lib/geminiServer";
import type { CharacterSpec } from "@/lib/types";

interface GenerateBody {
  mode?: "character" | "look";
  prompt?: string;
  spec?: CharacterSpec;
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body (expected JSON)." },
      { status: 400 },
    );
  }

  try {
    if (body.mode === "look") {
      if (!body.spec || typeof body.spec !== "object") {
        return NextResponse.json(
          { error: "Missing character spec to regenerate the look." },
          { status: 400 },
        );
      }
      // Sanitize before sending to the model so the prompt is stable.
      const spec = sanitizeSpec(body.spec);
      const { spec: next, model } = await generateLook(spec);
      return NextResponse.json({ spec: next, model });
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing character description (prompt)." },
        { status: 400 },
      );
    }
    if (prompt.length > 500) {
      return NextResponse.json(
        { error: "The description is too long (max. 500 characters)." },
        { status: 400 },
      );
    }
    const { spec, model } = await generateCharacter(prompt);
    return NextResponse.json({ spec, model });
  } catch (err) {
    const message = serverErrorToMessage(err);
    const status =
      /401|403|GEMINI_KEY/.test(message) ? 500 : message.includes("429") ? 429 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
