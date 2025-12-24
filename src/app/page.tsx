"use client";

import { useState } from "react";

type TranscriptResponse = {
  transcript: string;
  language?: string;
};

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setTranscript("");
    setLanguage("");

    if (!file) {
      setError("Vui lòng chọn file audio trước khi upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsLoading(true);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Không thể nhận transcript.");
      }

      const data = (await response.json()) as TranscriptResponse;
      setTranscript(data.transcript);
      setLanguage(data.language ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Có lỗi xảy ra.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ marginBottom: 12 }}>Meeting Minutes Export</h1>
      <p style={{ marginTop: 0, marginBottom: 24, color: "#555" }}>
        Upload audio (.mp3, .m4a, .wav) để tạo transcript tiếng Anh/Trung và xem
        preview trước khi dịch.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: 16, marginBottom: 24 }}
      >
        <input
          type="file"
          accept=".mp3,.m4a,.wav"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: "10px 16px",
            backgroundColor: "#1a73e8",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Đang transcribe..." : "Upload & Transcribe"}
        </button>
      </form>

      {error && (
        <div style={{ color: "#b00020", marginBottom: 16 }}>{error}</div>
      )}

      {transcript && (
        <section
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Transcript Preview</h2>
          {language && (
            <p style={{ marginTop: 0, color: "#666" }}>
              Ngôn ngữ phát hiện: {language}
            </p>
          )}
          <pre
            style={{
              whiteSpace: "pre-wrap",
              margin: 0,
              fontFamily: "inherit",
            }}
          >
            {transcript}
          </pre>
        </section>
      )}
    </main>
  );
}
