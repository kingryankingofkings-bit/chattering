/** Anthropic Messages API adapter. */
import { estimateTokens, type TextProvider, type TextRequest, type TextResult } from "../types";

export class AnthropicTextProvider implements TextProvider {
  readonly name = "anthropic";
  constructor(readonly model: string, private apiKey: string, private baseUrl = "https://api.anthropic.com") {}

  private body(req: TextRequest, stream: boolean) {
    const system = req.json ? `${req.system}\n\nRespond with a single JSON object and nothing else.` : req.system;
    return {
      model: this.model,
      stream,
      max_tokens: req.maxTokens ?? 700,
      temperature: req.temperature ?? 0.9,
      system,
      messages: req.messages.filter((m) => m.role !== "system"),
    };
  }

  private headers() {
    return { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" };
  }

  async complete(req: TextRequest): Promise<TextResult> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, { method: "POST", headers: this.headers(), body: JSON.stringify(this.body(req, false)), signal: req.signal });
    if (!res.ok) throw new Error(`Text provider error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text: string = (data.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return {
      text,
      usage: { promptTokens: data.usage?.input_tokens ?? 0, completionTokens: data.usage?.output_tokens ?? estimateTokens(text) },
      model: data.model ?? this.model,
      provider: this.name,
    };
  }

  async *stream(req: TextRequest): AsyncGenerator<string, TextResult, void> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, { method: "POST", headers: this.headers(), body: JSON.stringify(this.body(req, true)), signal: req.signal });
    if (!res.ok || !res.body) throw new Error(`Text provider error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    let inTok = 0;
    let outTok = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(line.slice(5).trim());
          if (ev.type === "content_block_delta" && ev.delta?.text) {
            full += ev.delta.text;
            yield ev.delta.text;
          } else if (ev.type === "message_start") inTok = ev.message?.usage?.input_tokens ?? 0;
          else if (ev.type === "message_delta") outTok = ev.usage?.output_tokens ?? outTok;
        } catch {
          /* partial */
        }
      }
    }
    return { text: full, usage: { promptTokens: inTok, completionTokens: outTok || estimateTokens(full) }, model: this.model, provider: this.name };
  }
}
