import Link from "next/link";
import { notFound } from "next/navigation";

const DOCS: Record<string, { title: string; sections: [string, string][] }> = {
  terms: {
    title: "Terms of Service",
    sections: [
      ["Eligibility", "Chattering is for adults only. You must be at least 18 years old (or the age of majority where you live, if higher) and legally permitted to view adult material. We may suspend accounts that misrepresent age."],
      ["Fictional content", "All characters, stories, comics and images on Chattering are fictional and generated with AI. They do not depict real people. You may not upload or describe real people for sexual content."],
      ["Your content", "You keep ownership of characters and works you create. You grant us a license to store, process and, when you choose to publish, display them to other members. Private content stays private unless you publish it."],
      ["Acceptable use", "You agree to the Community Guidelines and Content Policy. Prohibited content is removed and repeat offenders lose access. We cooperate with lawful requests regarding illegal material."],
      ["AI output", "Generated text and images can be inaccurate or surprising. Treat them as fiction. Do not rely on them for advice of any kind."],
      ["Subscriptions", "Paid tiers renew until cancelled. Cancel any time from your Blackbook; access continues until the end of the paid period."],
      ["Termination", "You can delete your account at any time from Blackbook › Account. We may terminate accounts that break these terms."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["What we store", "Your email, a salted password hash, profile details, preferences, your characters, chats, generations, collections and moderation records."],
      ["Encryption", "Chats, personas, character sheets, prompts and generated media are encrypted at rest with AES-256-GCM. Transport is always TLS. Session tokens are stored hashed."],
      ["AI providers", "When you chat or generate, the relevant prompt is sent to the configured AI provider to produce a response. Providers may be changed; see the Content Policy for what is never sent."],
      ["Private by default", "New characters, chats, stories, comics and images are private. Nothing is public until you explicitly publish it, and the publish dialog tells you exactly what becomes visible."],
      ["Your rights", "Export all of your data as JSON or delete your account from Blackbook › Account. Deletion removes your content and personal data within 30 days, except records we must keep for legal or safety reasons."],
      ["Cookies", "We use only strictly necessary cookies: a session cookie and an age-confirmation cookie."],
      ["Contact", "Privacy questions: privacy@chattering.example"],
    ],
  },
  guidelines: {
    title: "Community Guidelines",
    sections: [
      ["Adults, fiction, consent", "Every character is an adult, every character is fictional, and every intimate scenario is between consenting adults. That is the whole foundation."],
      ["Respect creators", "Rate honestly. Report content that breaks the rules; do not brigade. Block or hide what you do not want to see."],
      ["Respect limits", "Users set hard limits and characters have boundaries. Scenes that ignore them will be moderated."],
      ["No harassment", "Do not use the platform to target, impersonate or harass anyone, inside or outside Chattering."],
      ["Publishing", "Only publish content you created here. Label intensity honestly so blur and filters work for everyone."],
      ["Appeals", "If your content is hidden or removed, you can appeal from your Blackbook. A human reviews every appeal."],
    ],
  },
  "content-policy": {
    title: "Content Policy",
    sections: [
      ["Always prohibited", "Sexual content involving minors or minor-coded characters (including age-play framed as underage, school settings implying minors, or childlike bodies). Sexualized real people, celebrities, deepfakes or face-swaps. Non-consensual sexual exploitation, including drugged, unconscious or coerced scenarios. Incest, including step-family framing. Bestiality. Trafficking, sexual slavery or any illegal content."],
      ["How enforcement works", "Automated filters screen every character field, prompt and message before it reaches a model. Hits are blocked with an explanation. Reports go to a moderation queue; moderators can hide or remove content and warn or suspend accounts. Every action can be appealed."],
      ["Intensity labels", "Creators label characters and works as Suggestive, Explicit or Intense. Members can cap what they see and blur covers by default."],
      ["Allowed", "Consensual adult romance and erotica across genders, orientations and dynamics, including consensual power exchange, fantasy and sci-fi settings, and dark themes handled between consenting adult characters."],
      ["Reporting", "Use the Report button on any character, comic, story, image or creator. Reports are confidential."],
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="font-display text-2xl">Chatter<span className="text-accent-2">ing</span></Link>
      <h1 className="mt-6 text-3xl">{doc.title}</h1>
      <p className="mt-1 text-xs text-muted">Last updated September 2026</p>
      <div className="mt-6 space-y-6">
        {doc.sections.map(([h, body]) => (
          <section key={h}>
            <h2 className="text-lg">{h}</h2>
            <p className="mt-1 text-sm leading-relaxed text-fg-2">{body}</p>
          </section>
        ))}
      </div>
      <nav className="mt-10 flex flex-wrap gap-3 text-xs text-muted">
        {Object.entries(DOCS).map(([s, d]) => (
          <Link key={s} href={`/legal/${s}`} className="underline">{d.title}</Link>
        ))}
      </nav>
    </div>
  );
}
