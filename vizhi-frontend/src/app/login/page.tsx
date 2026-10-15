"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { setCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options?: object) => void;
        };
      };
    };
  }
}

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleInitialized = useRef(false);

  const handleGoogleCredential = useCallback(
    async (response: { credential?: string }) => {
      if (!response.credential) {
        setError("Google did not return an identity token");
        return;
      }
      setError("");
      setLoading(true);
      try {
        const session = await api.loginWithGoogle(response.credential);
        setCurrentUser(session.user);
        router.replace("/dashboard");
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Google login failed");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const initializeGoogle = useCallback(() => {
    if (googleInitialized.current) return;
    if (!googleClientId || !window.google || !googleButtonRef.current) return;

    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        width: 320,
      });
      googleInitialized.current = true;
    } catch (err) {
      console.error("Google initialization failed", err);
      setError("Google login initialization failed");
    }
  }, [handleGoogleCredential]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.google) {
      initializeGoogle();
    }
  }, [initializeGoogle]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initializeGoogle}
      />
      <Card className="w-full max-w-[400px]">
        <CardHeader className="py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-[34px] w-[34px] items-center justify-center bg-[var(--brand)] text-[13px] font-bold text-[var(--brand-ink)]">
              V
            </span>
            <div>
              <CardTitle className="text-base">Vizhi</CardTitle>
              <p className="text-xs text-[var(--ink-tertiary)]">Sign in to the control plane</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 py-6">
          {googleClientId ? (
            <>
              <p className="text-center text-[13px] text-[var(--ink-secondary)]">
                Continue with your Google account. New accounts are created on first sign-in.
              </p>
              {/* Google's iframe is light-scheme; inside our dark page the browser
                  paints it an opaque white backdrop. Matching the scheme here
                  keeps it transparent, so only the button's own border shows. */}
              <div className="flex min-h-[44px] justify-center [color-scheme:light]">
                <div ref={googleButtonRef} />
              </div>
              {loading ? <p className="text-center text-xs text-[var(--ink-tertiary)]">Signing in…</p> : null}
            </>
          ) : (
            <p className="border border-[var(--warn-border)] bg-[var(--warn-soft)] px-3 py-2.5 text-xs text-[var(--warn)]">
              Google sign-in is not configured. Set <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> and restart the frontend.
            </p>
          )}
          <FieldError message={error} />
        </CardContent>
      </Card>
    </main>
  );
}
