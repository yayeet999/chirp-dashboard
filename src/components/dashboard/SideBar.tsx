
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  Home, 
  Menu, 
  X, 
  LogOut, 
  Twitter, 
  Bot
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

interface SideBarProps {
  isOpen: boolean;
  toggle: () => void;
}

export const SideBar: React.FC<SideBarProps> = ({ isOpen, toggle }) => {
  const location = useLocation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const handleLogout = () => {
    // Clear authentication status
    localStorage.removeItem("isAuthenticated");
    
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    
    navigate("/");
  };

  // Sidebar items
  const navigationItems = [
    { 
      name: "Dashboard", 
      path: "/dashboard", 
      icon: <Home className="h-5 w-5" />,
    },
    { 
      name: "FirasGPT", 
      path: "/dashboard/firasgpt", 
      icon: <Bot className="h-5 w-5" />,
    },
    { 
      name: "Settings", 
      path: "/dashboard/settings", 
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  return (
    <>
      {/* Dark overlay for mobile when sidebar is open */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
          onClick={toggle}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 h-full z-40 bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out
                   ${isOpen ? "translate-x-0" : "-translate-x-full"} 
                   ${isMobile ? "w-[280px]" : "w-[280px] lg:translate-x-0"}`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between px-4">
            <Link 
              to="/dashboard" 
              className="flex items-center gap-2 font-semibold"
              onClick={isMobile ? toggle : undefined}
            >
              <Twitter className="h-6 w-6 text-primary" />
              <span className="text-lg">TweetAutomation</span>
            </Link>
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={toggle}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
          
          <Separator className="bg-sidebar-border" />
          
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-6 px-4">
            <ul className="space-y-2">
              {navigationItems.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    onClick={isMobile ? toggle : undefined}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors
                               ${location.pathname === item.path 
                                 ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                 : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"}`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          
          {/* Footer */}
          <div className="p-4">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default SideBar;
