"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container">
      <header className="page-header">
        <h1>Something went wrong</h1>
        <p>{error.message || "Unexpected application error."}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.75rem",
            border: "none",
            borderRadius: "8px",
            padding: "0.6rem 0.9rem",
            cursor: "pointer",
            background: "#0f62fe",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          Try again
        </button>
      </header>
    </main>
  );
}
