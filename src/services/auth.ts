
import { supabase } from "@/integrations/supabase/client";

export type AuthError = {
  message: string;
};

export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error: { message: error.message } };
    }

    return { user: data.user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message || "An unknown error occurred" } };
  }
};

export const signUp = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { user: null, error: { message: error.message } };
    }

    return { user: data.user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message || "An unknown error occurred" } };
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return { error: { message: error.message } };
    }
    
    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || "An unknown error occurred" } };
  }
};

export const getCurrentUser = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      return { user: null, error: { message: error.message } };
    }
    
    return { user: data.session?.user || null, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message || "An unknown error occurred" } };
  }
};
