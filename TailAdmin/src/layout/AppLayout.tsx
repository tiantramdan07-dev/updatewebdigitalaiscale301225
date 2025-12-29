import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet, useNavigate, useLocation } from "react-router";
import { useEffect } from "react";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ ALLOWED ROUTES tanpa login
  const publicRoutes = ["/signin", "/signup"];

useEffect(() => {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  // ⛔ Jika tidak ada token & sedang bukan di public page → kembali ke login
  if (!token && !publicRoutes.includes(location.pathname)) {
    navigate("/signin");
  }
}, [location.pathname, navigate]);

  return (
    <div className="min-h-screen xl:flex">
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        <div className="p-4 mx-auto max-w-screen-2xl md:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;
