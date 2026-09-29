/** Works with OpenAI, OpenRouter, Together, LM Studio, vLLM, Ollama (OpenAI mode), etc. */
import { estimateTokens, type TextProvider, type TextRequest, type TextResult } from "../types";

export class OpenAICompatibleTextProvider implements TextProvider {
  readonly name = "openai-compatible";
  constructor(readonly model: string, private apiKey: string, private baseUrl: string) {}

  private body(req: TextRequest, stream: boolean) {
    return {
      model: this.model,
      stream,
      temperature: req.temperature ?? 0.9,
      max_tokens: req.maxTokens ?? 700,
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: req.system }, ...req.messages],
    };
  }

  private headers() {
    return { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` };
  }

  async complete(req: TextRequest): Promise<TextResult> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.body(req, false)),
      signal: req.signal,
    });
    if (!res.ok) throw new Error(`Text provider error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    return {
      text,
      usage: { promptTokens: data.usage?.prompt_tokens ?? 0, completionTokens: data.usage?.completion_tokens ?? estimateTokens(text) },
      model: data.model ?? this.model,
      provider: this.name,
    };
  }

  async *stream(req: TextRequest): AsyncGenerator<string, TextResult, void> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.body(req, true)),
      signal: req.signal,
    });
    if (!res.ok || !res.body) throw new Error(`Text provider error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            yield delta;
          }
        } catch {
          /* ignore partial */
        }
      }
    }
    return {
      text: full,
      usage: { promptTokens: estimateTokens(req.system + req.messages.map((m) => m.content).join("")), completionTokens: estimateTokens(full) },
      model: this.model,
      provider: this.name,
    };
  }
}
