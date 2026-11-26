import React, { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthProvider } from "./contextAuth/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import "./index.css";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";

import CustomerDashboard from "./pages/customer/Dashboard";
import AgentDashboard from "./pages/agent/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import Analytics from "./pages/admin/Analytics";
import Users from "./pages/admin/Users";

import ProtectedRoute from "./routes/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./components/Home";
import CompanyForm from "./pages/company/CompanyForm";
import CompanyList from "./pages/company/CompanyList";
import CompanyCreate from "./pages/company/CompanyCreate";
import CompanyView from "./pages/company/CompanyView";
import CompanyEdit from "./pages/company/CompanyEdit";
import LocationList from "./pages/location/LocationList";
import LocationCreate from "./pages/location/LocationCreate";
import LocationEdit from "./pages/location/LocationEdit";
import LocationView from "./pages/location/LocationView";
import AdvertisementList from "./pages/Advertiesment/AdvertisementList";
import AdvertisementCreate from "./pages/Advertiesment/AdvertisementCreate";
import AdvertisementView from "./pages/Advertiesment/AdvertisementView";
import AdvertisementEdit from "./pages/Advertiesment/AdvertisementEdit";
import PlaylistBuilder from "./pages/Advertiesment/PlaylistBuilder";
import AdScreen from "./pages/Advertiesment/AdScreen";
import PairScreen from "./pages/Advertiesment/PairScreen";
import LiveScreens from "./pages/LiveScreens";
import AddDevice from "./pages/Device/Adddevice";
import DeviceList from "./pages/Device/DeviceList";

/* =========================
   LAYOUT WRAPPER COMPONENT
========================= */
function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  /* ✅ Smart TV fallback */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const screenToken = params.get("screen");

    if (screenToken && !location.pathname.startsWith("/screen")) {
      navigate(`/screen/${screenToken}`, { replace: true });
    }
  }, [location, navigate]);

  const hideLayout =
    location.pathname.startsWith("/screen") ||
    location.pathname.startsWith("/pair") ||
    location.pathname.startsWith("/tv");

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {!hideLayout && <Navbar />}

      <div className="flex-1 w-full flex flex-col">{children}</div>

      {!hideLayout && <Footer />}
    </div>
  );
}

const ManagerRoute = ({ children }) => (
  <ProtectedRoute roles={["admin", "company_admin"]}>{children}</ProtectedRoute>
);

const SuperAdminRoute = ({ children }) => (
  <ProtectedRoute role="admin">{children}</ProtectedRoute>
);

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Layout>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/screen/:token" element={<AdScreen />} />
                <Route path="/pair" element={<PairScreen />} />
                <Route path="/tv" element={<PairScreen />} />

                {/* Super Admin Only Routes */}
                <Route
                  path="/company-add"
                  element={
                    <SuperAdminRoute>
                      <CompanyForm />
                    </SuperAdminRoute>
                  }
                />
                <Route
                  path="/companies/new"
                  element={
                    <SuperAdminRoute>
                      <CompanyCreate />
                    </SuperAdminRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <SuperAdminRoute>
                      <Users />
                    </SuperAdminRoute>
                  }
                />

                {/* Protected VMS Manager Routes (Admin & Company Admin) */}
                <Route
                  path="/admin"
                  element={
                    <ManagerRoute>
                      <AdminDashboard />
                    </ManagerRoute>
                  }
                />

                <Route
                  path="/companies"
                  element={
                    <ManagerRoute>
                      <CompanyList />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/companies/:id"
                  element={
                    <ManagerRoute>
                      <CompanyView />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/companies/:id/edit"
                  element={
                    <ManagerRoute>
                      <CompanyEdit />
                    </ManagerRoute>
                  }
                />

                <Route
                  path="/locations"
                  element={
                    <ManagerRoute>
                      <LocationList />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/locations/new"
                  element={
                    <ManagerRoute>
                      <LocationCreate />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/locations/:id"
                  element={
                    <ManagerRoute>
                      <LocationView />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/locations/:id/edit"
                  element={
                    <ManagerRoute>
                      <LocationEdit />
                    </ManagerRoute>
                  }
                />

                <Route
                  path="/advertisements"
                  element={
                    <ManagerRoute>
                      <AdvertisementList />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/advertisements/new"
                  element={
                    <ManagerRoute>
                      <AdvertisementCreate />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/advertisements/:id"
                  element={
                    <ManagerRoute>
                      <AdvertisementView />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/advertisements/:id/edit"
                  element={
                    <ManagerRoute>
                      <AdvertisementEdit />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/playlist-builder"
                  element={
                    <ManagerRoute>
                      <PlaylistBuilder />
                    </ManagerRoute>
                  }
                />

                <Route
                  path="/live-screens"
                  element={
                    <ManagerRoute>
                      <LiveScreens />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ManagerRoute>
                      <Analytics />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/add-device"
                  element={
                    <ManagerRoute>
                      <AddDevice />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/devices"
                  element={
                    <ManagerRoute>
                      <DeviceList />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/edit-device/:id"
                  element={
                    <ManagerRoute>
                      <AddDevice />
                    </ManagerRoute>
                  }
                />

                {/* Customer / Agent Dashboards */}
                <Route
                  path="/customer"
                  element={
                    <ProtectedRoute role="customer">
                      <CustomerDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/agent"
                  element={
                    <ProtectedRoute role="agent">
                      <AgentDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="*"
                  element={
                    <div className="p-10 text-center">
                      <h1 className="text-2xl font-bold mb-2">
                        404 - Page Not Found
                      </h1>
                      <a href="/" className="text-blue-600 underline">
                        Go Home
                      </a>
                    </div>
                  }
                />
              </Routes>
            </Layout>
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
