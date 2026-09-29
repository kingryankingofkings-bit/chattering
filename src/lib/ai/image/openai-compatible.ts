/** OpenAI Images API shape (also served by many hosted diffusion gateways). */
import { dims, type ImageProvider, type ImageRequest, type ImageResult } from "../types";

export class OpenAICompatibleImageProvider implements ImageProvider {
  readonly name = "openai-compatible";
  constructor(readonly model: string, private apiKey: string, private baseUrl: string) {}

  async generate(req: ImageRequest): Promise<ImageResult> {
    const { width, height } = dims(req.orientation);
    const prompt = [req.style ? `${req.style} style.` : "", req.characterSheet ? `Character: ${req.characterSheet}.` : "", req.prompt, req.negativePrompt ? `Avoid: ${req.negativePrompt}` : ""].filter(Boolean).join(" ");
    const res = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, prompt, n: 1, size: `${width}x${height}`, response_format: "b64_json" }),
      signal: req.signal,
    });
    if (!res.ok) throw new Error(`Image provider error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const b64: string | undefined = data.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image provider returned no image");
    return { data: Buffer.from(b64, "base64"), mime: "image/png", width, height, seed: req.seed ?? 0, model: this.model, provider: this.name };
  }
}
