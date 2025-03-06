
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "@/components/auth/LoginForm";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if already authenticated
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [navigate]);
  
  return <LoginForm />;
};

export default LoginPage;
