import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Public layout wrapper
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

// Pages
import HomePage from "@/pages/HomePage";
import ServicesPage from "@/pages/ServicesPage";
import PortfolioPage from "@/pages/PortfolioPage";
import BookingPage from "@/pages/BookingPage";
import NotFound from "@/pages/NotFound";

// Admin
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminServicesPage from "@/pages/admin/AdminServicesPage";
import AdminPortfolioPage from "@/pages/admin/AdminPortfolioPage";
import AdminAppointmentsPage from "@/pages/admin/AdminAppointmentsPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AdminPromotionsPage from "@/pages/admin/AdminPromotionsPage";
import AdminClientsPage from "@/pages/admin/AdminClientsPage";

const queryClient = new QueryClient();

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
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
          <Route path="/services" element={<PublicLayout><ServicesPage /></PublicLayout>} />
          <Route path="/portfolio" element={<PublicLayout><PortfolioPage /></PublicLayout>} />
          <Route path="/booking" element={<PublicLayout><BookingPage /></PublicLayout>} />

          {/* Admin login */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Admin panel */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="services" element={<AdminServicesPage />} />
            <Route path="portfolio" element={<AdminPortfolioPage />} />
            <Route path="appointments" element={<AdminAppointmentsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
