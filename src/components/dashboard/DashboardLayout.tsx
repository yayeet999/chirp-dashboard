
import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import SideBar from "./SideBar";
import Navbar from "./Navbar";
import { getCurrentUser, signOut } from "@/services/auth";
import { useToast } from "@/hooks/use-toast";

export const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  useEffect(() => {
    const checkAuth = async () => {
      const { user, error } = await getCurrentUser();
      
      if (error || !user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to access the dashboard",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      
      setIsLoading(false);
    };
    
    checkAuth();
  }, [navigate, toast]);

  // Calculate page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/dashboard") return "Dashboard";
    if (path === "/dashboard/firasgpt") return "FirasGPT";
    if (path === "/dashboard/settings") return "Settings";
    return "Dashboard";
  };
  
  const handleSignOut = async () => {
    const { error } = await signOut();
    
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SideBar 
        isOpen={isSidebarOpen} 
        toggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        onSignOut={handleSignOut}
      />
      
      <div className="flex flex-1 flex-col overflow-hidden lg:pl-[280px]">
        <Navbar 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          title={getPageTitle()}
        />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
