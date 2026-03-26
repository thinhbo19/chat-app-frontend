export function getApiErrorMessage(error: unknown, fallback = "Đã có lỗi xảy ra"): string {
  const data = (
    error as {
      response?: { data?: { message?: string; error?: { message?: string } } };
    }
  )?.response?.data;
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  return fallback;
}
