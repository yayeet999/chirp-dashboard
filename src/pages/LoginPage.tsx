
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/services/auth";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const checkAuth = async () => {
      const { user } = await getCurrentUser();
      if (user) {
        navigate("/dashboard");
      }
      setIsLoading(false);
    };
    
    checkAuth();
  }, [navigate]);
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return <LoginForm />;
};

export default LoginPage;
