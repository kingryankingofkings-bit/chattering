/**
 * Offline image provider: renders a stylized, deterministic SVG "artwork" from
 * the prompt hash so galleries and comics have real, unique images without a
 * diffusion backend. Swap for a real provider via AI_IMAGE_PROVIDER.
 */
import { hash32, mulberry32 } from "../../utils";
import { dims, type ImageProvider, type ImageRequest, type ImageResult } from "../types";

const PALETTES: Record<string, string[][]> = {
  "noir-ink": [["#0b0810", "#2a1b2e", "#c4b5a0"], ["#050505", "#3a2f3f", "#e0d4c0"]],
  painterly: [["#3b0a2a", "#b3163f", "#ffb38a"], ["#1c0f2b", "#7a2a6e", "#f7c59f"]],
  anime: [["#1a0f3c", "#ff5fa2", "#8be9fd"], ["#0f1a3c", "#ffa2e0", "#ffe36e"]],
  watercolor: [["#2b1a2f", "#d97a9e", "#f2d7d5"], ["#1f2a44", "#7ea2d6", "#f5e6cc"]],
  neon: [["#05010f", "#ff2e88", "#00f0ff"], ["#0a0016", "#c400ff", "#00ff9c"]],
  "vintage-pulp": [["#2a1408", "#c8471e", "#f3d29b"], ["#1f1b12", "#a1301e", "#e3c78a"]],
  photoreal: [["#111111", "#5a3a3a", "#d9b8a8"], ["#0e0e12", "#3c2e45", "#e6cbb5"]],
};

function esc(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export class MockImageProvider implements ImageProvider {
  readonly name = "mock";
  readonly model: string;
  constructor(model = "mock-diffusion-1") {
    this.model = model;
  }

  async generate(req: ImageRequest): Promise<ImageResult> {
    const seed = req.seed ?? hash32(req.prompt + (req.characterSheet ?? ""));
    const rng = mulberry32(seed ^ hash32(req.prompt));
    const { width, height } = dims(req.orientation);
    const pal = PALETTES[req.style ?? "painterly"] ?? PALETTES.painterly;
    const [bg, mid, hi] = pal[Math.floor(rng() * pal.length)];
    const shapes: string[] = [];
    const n = 5 + Math.floor(rng() * 6);
    for (let i = 0; i < n; i++) {
      const cx = rng() * width;
      const cy = rng() * height;
      const r = (0.1 + rng() * 0.35) * Math.min(width, height);
      const color = rng() > 0.5 ? mid : hi;
      const op = (0.15 + rng() * 0.35).toFixed(2);
      if (rng() > 0.5) shapes.push(`<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${color}" opacity="${op}" filter="url(#blur)"/>`);
      else {
        const rot = (rng() * 360).toFixed(0);
        shapes.push(`<rect x="${(cx - r).toFixed(0)}" y="${(cy - r / 2).toFixed(0)}" width="${(r * 2).toFixed(0)}" height="${r.toFixed(0)}" rx="${(r / 3).toFixed(0)}" fill="${color}" opacity="${op}" transform="rotate(${rot} ${cx.toFixed(0)} ${cy.toFixed(0)})" filter="url(#blur)"/>`);
      }
    }
    // A figure silhouette suggestion: two soft ellipses.
    const fx = width * (0.35 + rng() * 0.3);
    const fy = height * (0.45 + rng() * 0.15);
    shapes.push(`<ellipse cx="${fx.toFixed(0)}" cy="${(fy - height * 0.22).toFixed(0)}" rx="${(width * 0.09).toFixed(0)}" ry="${(height * 0.08).toFixed(0)}" fill="${hi}" opacity="0.55"/>`);
    shapes.push(`<ellipse cx="${fx.toFixed(0)}" cy="${fy.toFixed(0)}" rx="${(width * 0.16).toFixed(0)}" ry="${(height * 0.22).toFixed(0)}" fill="${hi}" opacity="0.35"/>`);
    const label = esc(req.prompt.slice(0, 48));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="${Math.floor(width / 40)}"/></filter>
  <filter id="grain"><feTurbulence baseFrequency="0.8" numOctaves="2" seed="${seed % 100}"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0"/></filter>
</defs>
<rect width="100%" height="100%" fill="url(#g)"/>
${shapes.join("\n")}
<rect width="100%" height="100%" filter="url(#grain)"/>
<text x="24" y="${height - 28}" font-family="Georgia, serif" font-size="${Math.floor(width / 34)}" fill="${hi}" opacity="0.75">${label}</text>
</svg>`;
    return { data: Buffer.from(svg, "utf8"), mime: "image/svg+xml", width, height, seed, model: this.model, provider: this.name };
  }
}
