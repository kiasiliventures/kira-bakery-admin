import "server-only";

import { createHmac } from "node:crypto";

const DEFAULT_EXPIRY_SECONDS = 60;

type InternalTokenHeader = {
  alg: "HS256";
  typ: "internal-request";
};

type InternalRequestTokenClaims = {
  iss: string;
  aud: string;
  purpose: string;
  method: string;
  path: string;
  iat: number;
  exp: number;
  orderId?: string;
  idempotencyKey?: string;
};

type SignInternalRequestTokenInput = {
  secret: string;
  issuer: string;
  audience: string;
  purpose: string;
  method: string;
  path: string;
  expiresInSeconds?: number;
  orderId?: string;
  idempotencyKey?: string;
};

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signHmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signInternalRequestToken(input: SignInternalRequestTokenInput) {
  const now = Math.floor(Date.now() / 1000);
  const header: InternalTokenHeader = {
    alg: "HS256",
    typ: "internal-request",
  };
  const claims: InternalRequestTokenClaims = {
    iss: input.issuer,
    aud: input.audience,
    purpose: input.purpose,
    method: input.method.toUpperCase(),
    path: input.path,
    iat: now,
    exp: now + (input.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS),
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedClaims = encodeBase64Url(JSON.stringify(claims));
  const signature = signHmac(input.secret, `${encodedHeader}.${encodedClaims}`);

  return `${encodedHeader}.${encodedClaims}.${signature}`;
}

export function requireInternalRequestSigningSecret(envName: string) {
  const value = process.env[envName]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }

  return value;
}
