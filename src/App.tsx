import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionContextProvider, useSessionContext } from "@supabase/auth-helpers-react";
import { StrictMode } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Products from "./pages/Products";
import GlideSync from "./pages/GlideSync";
import GlideConnections from "./pages/GlideConnections";
import DatabaseChat from "./pages/DatabaseChat";
import Settings from "./pages/Settings";
import Inventory from "./pages/Inventory";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useSessionContext();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <Inventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/glide-sync"
        element={
          <ProtectedRoute>
            <GlideSync />
          </ProtectedRoute>
        }
      />
      <Route
        path="/glide-connections"
        element={
          <ProtectedRoute>
            <GlideConnections />
          </ProtectedRoute>
        }
      />
      <Route
        path="/database-chat"
        element={
          <ProtectedRoute>
            <DatabaseChat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
    </Routes>
  </BrowserRouter>
);

const App = () => (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionContextProvider supabaseClient={supabase}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </SessionContextProvider>
    </QueryClientProvider>
  </StrictMode>
);

export default App;