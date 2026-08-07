"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuthQuery } from "@/hooks/auth";

const ERROR_MESSAGES: Record<string, string> = {
  not_index_leader: "Du må være leder i Index for å bruke admin-panelet.",
  invalid_state: "Innloggingen ble avbrutt. Prøv igjen.",
  missing_code: "Innloggingen ble avbrutt. Prøv igjen.",
  token_exchange_failed: "Kunne ikke fullføre innloggingen. Prøv igjen senere.",
  groups_lookup_failed:
    "Innloggingen virket, men vi fikk ikke hentet gruppene dine fra TIHLDE. Prøv igjen, eller si fra til Index.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin";
  const { data: auth, isLoading: isCheckingAuth } = useAuthQuery();

  const [isLoading, setIsLoading] = useState(false);

  // Callbacken sender hit med ?error= når den avviser — blant annet når
  // brukeren logget inn riktig, men ikke er leder i Index.
  const error = searchParams.get("error");
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "Innloggingen feilet. Prøv igjen.")
    : "";

  useEffect(() => {
    if (auth) {
      router.push(redirectTo);
    }
  }, [auth, router, redirectTo]);

  const handleSignIn = () => {
    setIsLoading(true);
    // Full sideveksling, ikke fetch: autorisasjonsflyten er en navigasjon, og
    // brukeren skal se tihlde.org i adresselinjen når passordet skrives inn.
    window.location.href = "/api/auth/login";
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-950 via-gray-900 to-black">
        <div className="text-white text-xl">Laster...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-950 via-gray-900 to-black p-4">
      <div className="bg-white/95 backdrop-blur p-8 rounded-2xl shadow-2xl w-full max-w-md border-4 border-red-800">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-red-900">Mordvember</h1>
          <p className="text-gray-600">Admin Login</p>
        </div>

        <div className="space-y-6">
          <p className="text-gray-600 text-center text-sm">
            Du sendes til tihlde.org for å logge inn.
          </p>

          {errorMessage && (
            <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-red-900 to-red-700 text-white p-4 rounded-lg hover:from-red-800 hover:to-red-600 transition font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
          >
            {isLoading ? "Logger inn..." : "Logg inn med TIHLDE"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-gray-600 hover:text-red-700 transition text-sm"
          >
            Tilbake til hovedsiden
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-950 via-gray-900 to-black">
          <div className="text-white text-xl">Laster...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
