export const runtime = "nodejs";

const SUPPORTED_AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/wav"];

function extractTranscript(payload: unknown): { transcript: string; language?: string } {
  if (!payload || typeof payload !== "object") {
    return { transcript: "" };
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.transcript === "string") {
    return { transcript: record.transcript, language: record.language as string };
  }

  if (typeof record.text === "string") {
    return { transcript: record.text, language: record.language as string };
  }

  if (Array.isArray(record.results)) {
    const chunks = record.results
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .filter(Boolean);
    if (chunks.length > 0) {
      return { transcript: chunks.join(" ") };
    }
  }

  return { transcript: "" };
}

export async function POST(request: Request) {
  const apiKey = process.env.STT_API_KEY;
  const endpoint = process.env.STT_ENDPOINT;

  if (!apiKey || !endpoint) {
    return Response.json(
      {
        error:
          "Thiếu cấu hình STT_API_KEY hoặc STT_ENDPOINT. Vui lòng cập nhật biến môi trường.",
      },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: "Không tìm thấy file audio hợp lệ." },
      { status: 400 }
    );
  }

  if (!SUPPORTED_AUDIO_TYPES.includes(file.type)) {
    return Response.json(
      { error: "Định dạng audio chưa được hỗ trợ." },
      { status: 400 }
    );
  }

  const forwardFormData = new FormData();
  forwardFormData.append("file", file, file.name);
  forwardFormData.append("language", "en,zh");

  const sttResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: forwardFormData,
  });

  if (!sttResponse.ok) {
    const errorText = await sttResponse.text();
    return Response.json(
      {
        error: "Dịch vụ STT trả về lỗi.",
        details: errorText,
      },
      { status: 502 }
    );
  }

  const payload = await sttResponse.json();
  const { transcript, language } = extractTranscript(payload);

  if (!transcript) {
    return Response.json(
      { error: "Không thể trích xuất transcript từ dịch vụ STT." },
      { status: 502 }
    );
  }

  return Response.json({ transcript, language });
}
