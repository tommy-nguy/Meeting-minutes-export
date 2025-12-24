const TIMESTAMP_REGEX = /^\s*(\[?\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?\]?)(\s+|$)/;
const SPEAKER_REGEX = /^\s*([A-Za-z0-9 _-]{1,40}:)(\s+|$)/;

const translateButton = document.getElementById("translateButton");
const transcriptInput = document.getElementById("transcriptInput");
const originalOutput = document.getElementById("originalOutput");
const translationOutput = document.getElementById("translationOutput");
const copyTranslation = document.getElementById("copyTranslation");
const exportTranslation = document.getElementById("exportTranslation");

const apiBaseUrlInput = document.getElementById("apiBaseUrl");
const apiKeyInput = document.getElementById("apiKey");
const sourceLangSelect = document.getElementById("sourceLang");

const splitTranscriptSegments = (transcript) =>
  transcript.split(/\r?\n/).map((line) => {
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

const translateTranscript = async (transcript, { apiBaseUrl, apiKey, source, target }) => {
  const segments = splitTranscriptSegments(transcript);
  const texts = segments.map((segment) => segment.text).filter(Boolean);

  if (!texts.length) {
    return transcript;
  }

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ source, target, texts }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Translate API error: ${response.status} ${message}`);
  }

  const data = await response.json();
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
};

const updateOutputs = (original, translated) => {
  originalOutput.textContent = original;
  translationOutput.textContent = translated;
  copyTranslation.disabled = !translated.trim();
  exportTranslation.disabled = !translated.trim();
};

translateButton.addEventListener("click", async () => {
  const transcript = transcriptInput.value;
  updateOutputs(transcript, "");

  if (!transcript.trim()) {
    return;
  }

  translateButton.disabled = true;
  translateButton.textContent = "Translating...";

  try {
    const translated = await translateTranscript(transcript, {
      apiBaseUrl: apiBaseUrlInput.value,
      apiKey: apiKeyInput.value,
      source: sourceLangSelect.value,
      target: "VI",
    });
    updateOutputs(transcript, translated);
  } catch (error) {
    updateOutputs(transcript, `Error: ${error.message}`);
  } finally {
    translateButton.disabled = false;
    translateButton.textContent = "Translate";
  }
});

copyTranslation.addEventListener("click", async () => {
  if (!translationOutput.textContent) {
    return;
  }
  await navigator.clipboard.writeText(translationOutput.textContent);
  copyTranslation.textContent = "Copied!";
  setTimeout(() => {
    copyTranslation.textContent = "Copy translation";
  }, 1200);
});

exportTranslation.addEventListener("click", () => {
  const blob = new Blob([translationOutput.textContent || ""], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "transcript-vi.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});
