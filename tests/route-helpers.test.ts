import { describe, expect, it } from "vitest";

import {
  getRequestIp,
  getSafeClientFingerprint,
} from "@/lib/http/route-helpers";

function requestWithHeaders(headers: HeadersInit): Request {
  return new Request("https://admin.example.com/api/admin/orders", {
    headers,
  });
}

describe("admin route request identity helpers", () => {
  it("prefers Cloudflare and Fly client IP headers", () => {
    expect(
      getRequestIp(
        requestWithHeaders({
          "cf-connecting-ip": "203.0.113.10",
          "fly-client-ip": "203.0.113.20",
          "x-forwarded-for": "198.51.100.10",
          "x-vercel-id": "iad1::abc",
        }),
      ),
    ).toBe("203.0.113.10");

    expect(
      getRequestIp(
        requestWithHeaders({
          "fly-client-ip": "203.0.113.20",
          "x-forwarded-for": "198.51.100.10",
          "x-vercel-id": "iad1::abc",
        }),
      ),
    ).toBe("203.0.113.20");
  });

  it("only trusts generic forwarded IP headers when a known proxy marker is present", () => {
    expect(
      getRequestIp(
        requestWithHeaders({
          "x-forwarded-for": "198.51.100.10, 198.51.100.11",
          "x-real-ip": "203.0.113.30",
        }),
      ),
    ).toBe("unknown");

    expect(
      getRequestIp(
        requestWithHeaders({
          "x-forwarded-for": "198.51.100.10, 198.51.100.11",
          "x-real-ip": "203.0.113.30",
          "cf-ray": "abc123-KLA",
        }),
      ),
    ).toBe("198.51.100.10");

    expect(
      getRequestIp(
        requestWithHeaders({
          "x-real-ip": "203.0.113.30",
          "x-vercel-id": "iad1::abc",
        }),
      ),
    ).toBe("203.0.113.30");
  });

  it("builds a stable fingerprint without storing the raw user agent", () => {
    const request = requestWithHeaders({
      "user-agent": "Example Browser 1.0",
      "x-real-ip": "203.0.113.30",
    });

    const fingerprint = getSafeClientFingerprint(request);

    expect(fingerprint).toBe(getSafeClientFingerprint(request));
    expect(fingerprint).toMatch(/^ip:unknown:ua:[a-z0-9]+$/);
    expect(fingerprint).not.toContain("Example Browser");
  });
});
