export class ApiError extends Error {
  constructor(message, { status, payload, url }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.url = url;
  }
}

export async function apiRequest(path, { method = "GET", body, headers = {}, errorMessage, ...options } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined
      ? headers
      : {
          "Content-Type": "application/json",
          ...headers,
        },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...options,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message = typeof data.detail === "string"
      ? data.detail
      : errorMessage || `${method} ${path} failed (${response.status})`;
    throw new ApiError(message, {
      status: response.status,
      payload: data,
      url: path,
    });
  }

  return data;
}
