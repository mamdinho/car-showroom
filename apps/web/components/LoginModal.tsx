"use client";

import {
  Authenticator,
  ThemeProvider,
  createTheme,
  View,
} from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { fetchAuthSession } from "aws-amplify/auth";
import { Button } from "@/components/Button";
import { saveSession } from "@/lib/session";
import { useEffect, useState } from "react";

/** Minimal theme: only safe tokens, avoid unsupported per-component padding tokens */
const theme = createTheme({
  name: "carshowroom",
  tokens: {
    colors: {
      brand: {
        primary: {
          10: { value: "#eef2ff" },
          80: { value: "#4f46e5" },
          90: { value: "#4338ca" },
        },
      },
    },
    radii: {
      small: { value: "8px" },
      medium: { value: "12px" },
      large: { value: "16px" },
    },
    borderWidths: {
      small: { value: "1px" },
      medium: { value: "2px" },
    },
    components: {
      button: { borderRadius: { value: "{radii.medium}" } },
      fieldcontrol: { borderRadius: { value: "{radii.medium}" } },
      tabs: {
        item: {
          borderWidth: { value: "2px" },
          borderColor: { value: "transparent" },
          _active: { borderColor: { value: "{colors.brand.primary.80}" } },
        },
      },
    },
  },
});

export default function LoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [show, setShow] = useState(open);
  useEffect(() => setShow(open), [open]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* dim bg (click closes) */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        {/* modal shell */}
        <div className="relative w-full max-w-[560px] rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h3 className="font-semibold">Sign in</h3>
            <button
              aria-label="Close"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* body (use max height + scroll) */}
          <div className="px-5 pt-4 pb-5">
            <div className="max-h-[60vh] overflow-y-auto">
              <ThemeProvider theme={theme}>
                <div className="amplify-host">
                  <Authenticator
                    signUpAttributes={["email"]}
                    formFields={{
                      signIn: { username: { label: "Email" } },
                      signUp: { username: { label: "Email" } },
                    }}
                  >
                    <AuthSuccess onClose={onClose} />
                  </Authenticator>
                </div>
              </ThemeProvider>
            </div>
          </div>

          {/* footer pinned */}
          <div className="px-5 py-3 border-t bg-gray-50">
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Hard CSS fixes for Amplify */}
      <style jsx global>{`
        /* Remove Amplify card chrome inside the modal */
        .amplify-host .amplify-card {
          box-shadow: none !important;
          border: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
        }
        /* Compact tabs and remove outer gaps */
        .amplify-host .amplify-tabs {
          margin: 0 !important;
          border: 0 !important;
        }
        .amplify-host .amplify-tabs__list {
          margin: 0 !important;
        }
        .amplify-host .amplify-tabs__item {
          padding: 0.75rem 1rem !important;
        }
        /* Slightly tighten vertical spacing of fields */
        .amplify-host .amplify-field,
        .amplify-host .amplify-field-group {
          margin-top: 0.5rem !important;
          margin-bottom: 0.25rem !important;
        }
        /* Make primary buttons match site style */
        .amplify-host .amplify-button[data-variation="primary"] {
          background: #0e7490 !important; /* teal-700 */
          border-color: #0e7490 !important;
          border-radius: 12px !important;
        }
        .amplify-host .amplify-button[data-variation="primary"]:hover {
          background: #0f766e !important; /* teal-700/hover-ish */
          border-color: #0f766e !important;
        }
      `}</style>
    </div>
  );
}

/** derive expires_in from JWT; fallback 1h */
function decodeJwtExpIat(token?: string) {
  try {
    if (!token) return 3600;
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return 3600;
    const json =
      typeof window !== "undefined"
        ? atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(payloadB64, "base64").toString("utf8");
    const payload = JSON.parse(json);
    const diff = Number(payload.exp) - Number(payload.iat);
    return Number.isFinite(diff) && diff > 0 ? diff : 3600;
  } catch {
    return 3600;
  }
}

function AuthSuccess({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    (async () => {
      const s = await fetchAuthSession();
      const idToken = s.tokens?.idToken?.toString();
      const accessToken = s.tokens?.accessToken?.toString();
      if (idToken && accessToken) {
        saveSession({
          id_token: idToken,
          access_token: accessToken,
          expires_in: decodeJwtExpIat(accessToken),
        });
        onClose();
        window.location.href = "/cars";
      }
    })();
  }, [onClose]);

  return (
    <View className="flex flex-col items-center gap-3">
      <p>Signing you in…</p>
    </View>
  );
}
