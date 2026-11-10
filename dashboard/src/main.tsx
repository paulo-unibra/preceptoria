import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/inter";
import "@/styles.css";
import App, { ErrorBoundary } from "@/app";
import { AuthProvider } from "@/lib/auth";
import { ApiError } from "@/lib/api";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, error) =>
        count < 1 &&
        (!(error instanceof ApiError) ||
          error.status === 0 ||
          error.status >= 500),
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <BrowserRouter
            basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}
          >
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
