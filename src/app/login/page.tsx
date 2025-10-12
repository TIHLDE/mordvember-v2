"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUser } from "@/api/auth";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await loginUser(username, password);
      // Redirect to the intended page or admin
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError("Feil brukernavn eller passord");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-950 via-gray-900 to-black p-4">
      <div className="bg-white/95 backdrop-blur p-8 rounded-2xl shadow-2xl w-full max-w-md border-4 border-red-800">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-red-900">Mordvember</h1>
          <p className="text-gray-600">Admin Login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Brukernavn
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring focus:ring-red-200 focus:ring-opacity-50 text-black text-base transition disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Skriv inn brukernavn"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Passord
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring focus:ring-red-200 focus:ring-opacity-50 text-black text-base transition disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Skriv inn passord"
            />
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-red-900 to-red-700 text-white p-4 rounded-lg hover:from-red-800 hover:to-red-600 transition font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
          >
            {isLoading ? "Logger inn..." : "Logg inn"}
          </button>
        </form>

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
