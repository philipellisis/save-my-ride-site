import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

// Lambda owns CORS directly (rather than relying on HttpApi's declarative CorsConfiguration)
// because `sam local start-api` doesn't emulate API Gateway's built-in CORS/preflight handling —
// only the real deployed API Gateway does. Doing it here means local dev and prod behave the same.
const ALLOWED_ORIGIN_PATTERNS = [/^https?:\/\/localhost:\d+$/, /^https:\/\/(www\.)?save-my-ride\.com$/];

function findHeader(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const headers = event.headers ?? {};
  // API Gateway normalizes header keys to lowercase, but `sam local start-api`'s emulator
  // doesn't guarantee that — look up case-insensitively so local dev and prod both work.
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

function resolveCorsOrigin(event: APIGatewayProxyEventV2): string {
  const origin = findHeader(event, 'origin');
  if (origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    return origin;
  }
  return 'https://save-my-ride.com';
}

function corsHeaders(event: APIGatewayProxyEventV2): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveCorsOrigin(event),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export function isPreflight(event: APIGatewayProxyEventV2): boolean {
  return event.requestContext?.http?.method === 'OPTIONS';
}

export function preflightResponse(event: APIGatewayProxyEventV2): APIGatewayProxyResultV2 {
  return { statusCode: 204, headers: corsHeaders(event), body: '' };
}

export function jsonResponse(
  event: APIGatewayProxyEventV2,
  statusCode: number,
  body: unknown
): APIGatewayProxyResultV2 {
  return { statusCode, headers: corsHeaders(event), body: JSON.stringify(body) };
}
