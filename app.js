const MAX_FILE_SIZE = 50 * 1024 * 1024;

const audioFileInput = document.getElementById("audioFile");
const fileMeta = document.getElementById("fileMeta");
const trimStartInput = document.getElementById("trimStart");
const trimEndInput = document.getElementById("trimEnd");
const enableSplit = document.getElementById("enableSplit");
const splitOptions = document.getElementById("splitOptions");
const chunkDurationInput = document.getElementById("chunkDuration");
const overlapInput = document.getElementById("overlap");
const transcribeBtn = document.getElementById("transcribeBtn");
const progressArea = document.getElementById("progressArea");
const progressDetail = document.getElementById("progressDetail");
const resultArea = document.getElementById("result");

let audioDuration = 0;
let audioBufferCache = null;

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const updateFileMeta = (file) => {
  if (!file) {
    fileMeta.textContent = "";
    return;
  }
  const sizeText = formatBytes(file.size);
  const durationText = audioDuration ? `${audioDuration.toFixed(1)}s` : "đang đọc...";
  fileMeta.textContent = `Dung lượng: ${sizeText} • Thời lượng: ${durationText}`;
};

const showProgress = (message) => {
  progressArea.classList.remove("hidden");
  progressDetail.textContent = message;
};

const hideProgress = () => {
  progressArea.classList.add("hidden");
  progressDetail.textContent = "";
};

const setResult = (text) => {
  resultArea.textContent = text;
};

const ensureAudioContext = (() => {
  let context;
  return () => {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
    }
    return context;
  };
})();

const decodeAudio = async (file) => {
  if (audioBufferCache) return audioBufferCache;
  const arrayBuffer = await file.arrayBuffer();
  const context = ensureAudioContext();
  const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
  audioBufferCache = decoded;
  return decoded;
};

const encodeWav = (audioBuffer) => {
  const numOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;

  let samples;
  if (numOfChannels === 2) {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    samples = interleave(left, right);
  } else {
    samples = audioBuffer.getChannelData(0);
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChannels * 2, true);
  view.setUint16(32, numOfChannels * 2, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([buffer], { type: "audio/wav" });
};

const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const floatTo16BitPCM = (view, offset, input) => {
  for (let i = 0; i < input.length; i += 1) {
    const value = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset + i * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
};

const interleave = (inputL, inputR) => {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex += 1;
  }
  return result;
};

const sliceBuffer = (buffer, startSeconds, endSeconds) => {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(startSeconds * sampleRate);
  const endSample = Math.floor(endSeconds * sampleRate);
  const frameCount = Math.max(0, endSample - startSample);
  const trimmedBuffer = new AudioBuffer({
    length: frameCount,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: sampleRate,
  });

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const channelData = buffer.getChannelData(channel).slice(startSample, endSample);
    trimmedBuffer.copyToChannel(channelData, channel);
  }

  return trimmedBuffer;
};

const splitBuffer = (buffer, chunkDuration, overlapSeconds) => {
  const segments = [];
  const duration = buffer.duration;
  let currentStart = 0;

  while (currentStart < duration) {
    const currentEnd = Math.min(duration, currentStart + chunkDuration);
    segments.push(sliceBuffer(buffer, currentStart, currentEnd));
    if (currentEnd >= duration) break;
    currentStart = Math.max(0, currentEnd - overlapSeconds);
  }

  return segments;
};

const simulateTranscribe = async (blob, index, total) => {
  showProgress(`Đang gửi đoạn ${index} / ${total} (${formatBytes(blob.size)})`);
  await new Promise((resolve) => setTimeout(resolve, 900));
  return `Đoạn ${index} đã xử lý.`;
};

const resetState = () => {
  setResult("");
  hideProgress();
};

const validateFile = (file) => {
  if (!file) {
    setResult("Vui lòng chọn file audio trước khi transcribe.");
    return false;
  }
  if (file.size > MAX_FILE_SIZE) {
    setResult("File vượt quá 50MB. Vui lòng chọn file nhỏ hơn hoặc cắt/chia đoạn trước khi gửi.");
    return false;
  }
  return true;
};

const normalizeTrim = (startValue, endValue) => {
  let start = Math.max(0, startValue || 0);
  let end = endValue || 0;
  if (!audioDuration) {
    return { start: 0, end: 0, active: false };
  }
  if (end <= 0 || end > audioDuration) {
    end = audioDuration;
  }
  if (start >= end) {
    start = 0;
  }
  return { start, end, active: start > 0 || end < audioDuration };
};

const updateSplitOptions = () => {
  if (enableSplit.checked) {
    splitOptions.classList.add("active");
  } else {
    splitOptions.classList.remove("active");
  }
};

const handleTranscribe = async () => {
  resetState();
  const file = audioFileInput.files[0];
  if (!validateFile(file)) return;

  transcribeBtn.disabled = true;
  showProgress("Đang chuẩn bị dữ liệu audio...");

  try {
    const buffer = await decodeAudio(file);
    const { start, end, active } = normalizeTrim(
      Number(trimStartInput.value),
      Number(trimEndInput.value)
    );

    let workingBuffer = buffer;
    if (active) {
      workingBuffer = sliceBuffer(buffer, start, end);
    }

    let buffers = [workingBuffer];
    if (enableSplit.checked) {
      const chunkDuration = Math.max(10, Number(chunkDurationInput.value || 120));
      const overlap = Math.max(0, Number(overlapInput.value || 0));
      buffers = splitBuffer(workingBuffer, chunkDuration, overlap);
    }

    const transcripts = [];
    for (let i = 0; i < buffers.length; i += 1) {
      const wavBlob = encodeWav(buffers[i]);
      const transcript = await simulateTranscribe(wavBlob, i + 1, buffers.length);
      transcripts.push(transcript);
    }

    hideProgress();
    setResult(
      `Hoàn tất!\n${transcripts.join("\n")}\n\nGợi ý: tích hợp API STT thực tế để nhận bản ghi chi tiết.`
    );
  } catch (error) {
    hideProgress();
    setResult("Có lỗi khi xử lý audio. Vui lòng thử lại với file khác.");
    console.error(error);
  } finally {
    transcribeBtn.disabled = false;
  }
};

const handleFileChange = async () => {
  resetState();
  audioDuration = 0;
  audioBufferCache = null;
  const file = audioFileInput.files[0];
  if (!file) {
    updateFileMeta(null);
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    setResult("File vượt quá 50MB. Vui lòng chọn file nhỏ hơn.");
  }

  try {
    const buffer = await decodeAudio(file);
    audioDuration = buffer.duration;
    trimEndInput.value = audioDuration.toFixed(1);
  } catch (error) {
    setResult("Không thể đọc file audio. Vui lòng thử file khác.");
    console.error(error);
  }
  updateFileMeta(file);
};

audioFileInput.addEventListener("change", handleFileChange);
transcribeBtn.addEventListener("click", handleTranscribe);
enableSplit.addEventListener("change", updateSplitOptions);

updateSplitOptions();
