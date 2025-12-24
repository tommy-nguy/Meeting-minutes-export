export type LanguageCode = "EN" | "ZH" | "VI";

export type TranslateOptions = {
  apiBaseUrl: string;
  apiKey?: string;
  source: LanguageCode;
  target: LanguageCode;
};

type TranscriptSegment = {
  prefix: string;
  text: string;
};

const TIMESTAMP_REGEX =
  /^\s*(\[?\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?\]?)(\s+|$)/;
const SPEAKER_REGEX = /^\s*([A-Za-z0-9 _-]{1,40}:)(\s+|$)/;

export function splitTranscriptSegments(transcript: string): TranscriptSegment[] {
  return transcript.split(/\r?\n/).map((line) => {
    if (!line.trim()) {
      return { prefix: "", text: "" };
    }

    let remaining = line;
    let prefix = "";

    const timestampMatch = remaining.match(TIMESTAMP_REGEX);
    if (timestampMatch) {
      prefix += timestampMatch[1].trimEnd();
      remaining = remaining.slice(timestampMatch[0].length);
    }

    const speakerMatch = remaining.match(SPEAKER_REGEX);
    if (speakerMatch) {
      prefix += `${prefix ? " " : ""}${speakerMatch[1].trimEnd()}`;
      remaining = remaining.slice(speakerMatch[0].length);
    }

    return {
      prefix,
      text: remaining.trim(),
    };
  });
}

export async function translateTranscript(
  transcript: string,
  options: TranslateOptions,
): Promise<string> {
  const segments = splitTranscriptSegments(transcript);
  const texts = segments.map((segment) => segment.text).filter(Boolean);

  if (!texts.length) {
    return transcript;
  }

  const response = await fetch(`${options.apiBaseUrl.replace(/\/$/, "")}/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
    },
    body: JSON.stringify({
      source: options.source,
      target: options.target,
      texts,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Translate API error: ${response.status} ${message}`);
  }

  const data = (await response.json()) as { translations: string[] };
  if (!Array.isArray(data.translations)) {
    throw new Error("Translate API response missing translations.");
  }

  let translationIndex = 0;
  const translatedLines = segments.map((segment) => {
    if (!segment.text) {
      return "";
    }

    const translatedText = data.translations[translationIndex] ?? "";
    translationIndex += 1;

    return segment.prefix ? `${segment.prefix} ${translatedText}`.trim() : translatedText;
  });

  return translatedLines.join("\n");
}
