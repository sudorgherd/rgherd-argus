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
    throw new Error(data.detail || errorMessage || `${method} ${path} failed (${response.status})`);
  }

  return data;
}
