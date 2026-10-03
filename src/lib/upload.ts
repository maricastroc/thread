export type UploadOptions = {
  source: "recorded" | "imported";
  filename?: string;
  recordedAt?: Date;
  prompt?: string | null;
  onProgress?: (fraction: number) => void;
};

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function uploadAudio(blob: Blob, options: UploadOptions): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/recordings");
    xhr.setRequestHeader("content-type", blob.type || "application/octet-stream");
    xhr.setRequestHeader("x-cofre-source", options.source);
    if (options.filename) xhr.setRequestHeader("x-cofre-filename", encodeURIComponent(options.filename));
    if (options.prompt) xhr.setRequestHeader("x-cofre-prompt", encodeURIComponent(options.prompt));
    xhr.setRequestHeader("x-cofre-recorded-at", encodeURIComponent((options.recordedAt ?? new Date()).toISOString()));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new UploadError("Unexpected response", xhr.status));
        }
      } else {
        let message = "Upload failed";
        try {
          message = JSON.parse(xhr.responseText).error ?? message;
        } catch {}
        reject(new UploadError(message, xhr.status));
      }
    };
    xhr.onerror = () => reject(new UploadError("Network error", 0));
    xhr.send(blob);
  });
}
