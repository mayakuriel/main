import { BriefGenerator } from "@/components/brief-generator";

export default function HomePage() {
  return (
    <main className="container">
      <header className="page-header">
        <h1>Company Intelligence Brief Generator</h1>
        <p>
          Generate structured, sales-oriented intelligence briefs to evaluate fit for Wolt Benefits
          and identify the best outreach angle.
        </p>
      </header>
      <BriefGenerator />
    </main>
  );
}
