
import React from "react";
import { NavLink } from "react-router-dom";
import { BarChart3, Home, Settings, Twitter, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SideBarProps {
  isOpen: boolean;
  toggle: () => void;
  onSignOut: () => void;
}

const SideBar: React.FC<SideBarProps> = ({ isOpen, toggle, onSignOut }) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={toggle}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-[280px] bg-card/30 backdrop-blur-lg border-r transform transition-transform duration-300 ease-in-out lg:transform-none lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center px-4 justify-between border-b">
          <div className="flex items-center">
            <Twitter className="h-6 w-6 text-primary mr-2" />
            <h1 className="text-xl font-semibold">Tweet Automator</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={toggle} className="lg:hidden">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4 py-4">
          <div className="px-3 py-2">
            <div className="space-y-1">
              <NavLink 
                to="/dashboard" 
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-base transition-all hover:bg-accent",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )}
                end
              >
                <Home className="h-5 w-5" />
                <span>Dashboard</span>
              </NavLink>
              <NavLink 
                to="/dashboard/firasgpt" 
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-base transition-all hover:bg-accent",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )}
              >
                <Twitter className="h-5 w-5" />
                <span>FirasGPT</span>
              </NavLink>
              <NavLink 
                to="/dashboard/settings" 
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-base transition-all hover:bg-accent",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )}
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </NavLink>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 w-full px-3">
          <Button 
            variant="outline" 
            className="w-full flex justify-start"
            onClick={onSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </>
  );
};

export default SideBar;
