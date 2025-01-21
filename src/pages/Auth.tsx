import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AuthError, AuthApiError } from "@supabase/supabase-js";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const getErrorMessage = (error: AuthError) => {
    if (error instanceof AuthApiError) {
      switch (error.status) {
        case 400:
          if (error.message.includes("refresh_token_not_found")) {
            return "Your session has expired. Please sign in again.";
          }
          if (error.message.includes("missing email")) {
            return "Please enter your email address";
          }
          return "Invalid login credentials. Please check your email and password.";
        case 422:
          return "Invalid email format. Please enter a valid email address.";
        case 401:
          return "Invalid credentials. Please check your email and password.";
        default:
          return error.message;
      }
    }
    return "An unexpected error occurred. Please try again.";
  };

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      } else if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: getErrorMessage(error),
        });
      }
    };
    
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          navigate("/");
          toast({
            title: "Welcome!",
            description: "You have successfully signed in.",
          });
        } else if (event === "SIGNED_OUT") {
          navigate("/auth");
        } else if (event === "TOKEN_REFRESHED" && session) {
          // Handle successful token refresh
          navigate("/");
        } else if (event === "USER_UPDATED") {
          const { error } = await supabase.auth.getSession();
          if (error) {
            toast({
              variant: "destructive",
              title: "Error",
              description: getErrorMessage(error),
            });
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Welcome to Media Manager</h1>
          <p className="text-gray-500">Please sign in to continue</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <SupabaseAuth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#000000',
                    brandAccent: '#666666',
                  },
                },
              },
            }}
            providers={[]}
          />
        </div>
      </div>
    </div>
  );
};

export default Auth;