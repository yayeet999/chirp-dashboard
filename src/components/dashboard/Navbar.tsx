
import React from "react";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface NavbarProps {
  toggleSidebar: () => void;
  title: string;
}

export const Navbar: React.FC<NavbarProps> = ({ toggleSidebar, title }) => {
  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex h-full items-center px-4 lg:px-6">
        <Button 
          variant="ghost" 
          size="icon" 
          className="mr-4 lg:hidden" 
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
    </header>
  );
};

export default Navbar;
