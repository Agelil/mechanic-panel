import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

import { AuthProvider } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

import HomePage from "@/pages/HomePage";
import ServicesPage from "@/pages/ServicesPage";
import PortfolioPage from "@/pages/PortfolioPage";
import BookingPage from "@/pages/BookingPage";
import CabinetPage from "@/pages/CabinetPage";
import NotFound from "@/pages/NotFound";
import PrivacyPage from "@/pages/PrivacyPage";
import BookingSuccessPage from "@/pages/BookingSuccessPage";
import RegisterPage from "@/pages/RegisterPage";
import LoginPage from "@/pages/LoginPage";

import PortfolioDetailPage from "@/pages/PortfolioDetailPage";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminServicesPage from "@/pages/admin/AdminServicesPage";
import AdminPortfolioPage from "@/pages/admin/AdminPortfolioPage";
import AdminAppointmentsPage from "@/pages/admin/AdminAppointmentsPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AdminPromotionsPage from "@/pages/admin/AdminPromotionsPage";
import AdminClientsPage from "@/pages/admin/AdminClientsPage";
import AdminCategoriesPage from "@/pages/admin/AdminCategoriesPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminReviewsPage from "@/pages/admin/AdminReviewsPage";
import AdminAccessPage from "@/pages/admin/AdminAccessPage";
import AdminSystemPage from "@/pages/admin/AdminSystemPage";
import AdminGroupsPage from "@/pages/admin/AdminGroupsPage";
import AdminSupplyPage from "@/pages/admin/AdminSupplyPage";
import AdminWikiPage from "@/pages/admin/AdminWikiPage";
import PendingApprovalPage from "@/components/PendingApprovalPage";

// ── React Query: глобальная конфигурация с обработчиком auth-ошибок ──────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime:    5 * 60_000,
      retry: (failureCount, error) => {
        const msg = String((error as Error)?.message ?? "");
        if (msg.includes("JWT") || msg.includes("401") || msg.includes("403") || msg.includes("PGRST301")) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
      onError: (error) => {
        const msg = String((error as Error)?.message ?? "");
        if (msg.includes("JWT") || msg.includes("401") || msg.includes("PGRST301")) {
          // Auth-ошибка в мутации — тихо обновляем сессию и инвалидируем кэш
          supabase.auth.refreshSession().then(({ data }) => {
            if (data.session) queryClient.invalidateQueries();
          });
          return;
        }
        toast({
          title: "Ошибка запроса",
          description: msg || "Произошла неизвестная ошибка",
          variant: "destructive",
        });
      },
    },
  },
});

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* AuthProvider внутри BrowserRouter — useNavigate работает в useAuthGuard */}
        <AuthProvider>
          <Routes>
            <Route path="/"          element={<PublicLayout><HomePage /></PublicLayout>} />
            <Route path="/services"  element={<PublicLayout><ServicesPage /></PublicLayout>} />
            <Route path="/portfolio" element={<PublicLayout><PortfolioPage /></PublicLayout>} />
            <Route path="/portfolio/:id" element={<PublicLayout><PortfolioDetailPage /></PublicLayout>} />
            <Route path="/booking"   element={<PublicLayout><BookingPage /></PublicLayout>} />
            <Route path="/cabinet"   element={<PublicLayout><CabinetPage /></PublicLayout>} />
            <Route path="/privacy"   element={<PublicLayout><PrivacyPage /></PublicLayout>} />
            <Route path="/booking-success" element={<PublicLayout><BookingSuccessPage /></PublicLayout>} />
            <Route path="/register" element={<PublicLayout><RegisterPage /></PublicLayout>} />
            <Route path="/login"    element={<PublicLayout><LoginPage /></PublicLayout>} />

            <Route path="/admin/login"    element={<AdminLoginPage />} />
            <Route path="/admin/pending"  element={<PendingApprovalPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<ProtectedRoute permission="view_dashboard"><AdminDashboard /></ProtectedRoute>} />
              <Route path="services" element={<ProtectedRoute permission="view_services"><AdminServicesPage /></ProtectedRoute>} />
              <Route path="categories" element={<ProtectedRoute permission="view_categories"><AdminCategoriesPage /></ProtectedRoute>} />
              <Route path="portfolio" element={<ProtectedRoute permission="view_portfolio"><AdminPortfolioPage /></ProtectedRoute>} />
              <Route path="appointments" element={<ProtectedRoute permission="view_appointments"><AdminAppointmentsPage /></ProtectedRoute>} />
              <Route path="promotions" element={<ProtectedRoute permission="view_promotions"><AdminPromotionsPage /></ProtectedRoute>} />
              <Route path="clients" element={<ProtectedRoute permission="view_clients"><AdminClientsPage /></ProtectedRoute>} />
              <Route path="users" element={<ProtectedRoute permission="view_users"><AdminUsersPage /></ProtectedRoute>} />
              <Route path="reviews" element={<ProtectedRoute permission="view_reviews"><AdminReviewsPage /></ProtectedRoute>} />
              <Route path="access" element={<ProtectedRoute permission="view_users"><AdminAccessPage /></ProtectedRoute>} />
              <Route path="system" element={<ProtectedRoute permission="view_system"><AdminSystemPage /></ProtectedRoute>} />
              <Route path="groups" element={<ProtectedRoute permission="view_groups"><AdminGroupsPage /></ProtectedRoute>} />
              <Route path="supply" element={<ProtectedRoute permission="view_supply"><AdminSupplyPage /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute permission="view_settings"><AdminSettingsPage /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
