import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Layout } from "./components/Layout";

// Import main pages directly for instant navigation
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Kits from "./pages/Kits";
import Movements from "./pages/Movements";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Stock from "./pages/Stock";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Financeiro from "./pages/Financeiro";
import Contas from "./pages/Contas";
import PrevisaoEstoque from "./pages/PrevisaoEstoque";
import CriticalStockReport from "./pages/CriticalStockReport";

// Lazy load less frequently used pages
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LandingPage = lazy(() => import("./pages/LandingPage"));

// Loading component for Suspense (only for lazy loaded pages)
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
    </div>
  </div>
);

// Configure React Query with better caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route
                path="/"
                element={
                  <Layout>
                    <Dashboard />
                  </Layout>
                }
              />
              <Route
                path="/products"
                element={
                  <Layout>
                    <Products />
                  </Layout>
                }
              />
              <Route
                path="/kits"
                element={
                  <Layout>
                    <Kits />
                  </Layout>
                }
              />
              <Route
                path="/movements"
                element={
                  <Layout>
                    <Movements />
                  </Layout>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <Layout>
                    <Financeiro />
                  </Layout>
                }
              />
              <Route
                path="/contas"
                element={
                  <Layout>
                    <Contas />
                  </Layout>
                }
              />
              <Route
                path="/reports"
                element={
                  <Layout>
                    <Reports />
                  </Layout>
                }
              />
              <Route
                path="/stock"
                element={
                  <Layout>
                    <Stock />
                  </Layout>
                }
              />
              <Route
                path="/previsao-estoque"
                element={
                  <Layout>
                    <PrevisaoEstoque />
                  </Layout>
                }
              />
              <Route
                path="/estoque-critico"
                element={
                  <Layout>
                    <CriticalStockReport />
                  </Layout>
                }
              />
              <Route
                path="/settings"
                element={
                  <Layout>
                    <Settings />
                  </Layout>
                }
              />
              <Route
                path="/admin"
                element={
                  <Layout>
                    <Admin />
                  </Layout>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
