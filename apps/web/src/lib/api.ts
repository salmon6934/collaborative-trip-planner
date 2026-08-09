const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Fetch wrapper that adds the auth token to requests.
 */
export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, headers, ...rest } = options;

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) {
    fetchHeaders['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, {
    headers: fetchHeaders,
    ...rest,
  });
}

/**
 * Fetch the user's trips from the backend.
 */
export async function fetchTrips(token: string) {
  const res = await apiFetch('/api/trips', { token });
  if (!res.ok) {
    throw new Error('Failed to fetch trips');
  }
  const data = await res.json();
  return data.trips;
}

/**
 * Create a new trip.
 */
export async function createTripApi(
  token: string,
  input: { title: string; destination: string; startDate: string; endDate: string }
) {
  const res = await apiFetch('/api/trips', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to create trip');
  }
  const data = await res.json();
  return data.trip;
}
