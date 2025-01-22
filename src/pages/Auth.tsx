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
          if (error.message.includes("invalid_credentials")) {
            return "Invalid email or password. Please check your credentials and try again.";
          }
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
    <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-900/20 to-black animate-gradient">
          {/* Animated particles */}
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/30 rounded-full blur-3xl animate-float"></div>
            <div className="absolute top-3/4 right-1/4 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl animate-float delay-1000"></div>
            <div className="absolute bottom-1/4 left-1/2 w-36 h-36 bg-indigo-500/30 rounded-full blur-3xl animate-float delay-2000"></div>
          </div>
          
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-grid"></div>
        </div>
        
        {/* Animated borders */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse"></div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse"></div>
      </div>

      {/* Login container */}
      <div className="relative max-w-md w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg blur-xl animate-pulse"></div>
        <div className="relative backdrop-blur-xl bg-black/40 rounded-lg border border-white/10 p-8 shadow-2xl">
          {/* Logo and Title */}
          <div className="flex flex-col items-center justify-center gap-4 mb-8">
            <h1 className="text-3xl font-bold text-white">Media Manager</h1>
            <p className="text-white/60">Sign in to continue</p>
          </div>

          {/* Auth component */}
          <SupabaseAuth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "#3b82f6",
                    brandAccent: "#2563eb",
                    defaultButtonBackground: "rgba(0,0,0,0.4)",
                    defaultButtonBackgroundHover: "rgba(0,0,0,0.6)",
                    inputBackground: "rgba(0, 0, 0, 0.2)",
                    inputBorder: "rgba(255, 255, 255, 0.1)",
                    inputBorderHover: "rgba(59, 130, 246, 0.5)",
                    inputBorderFocus: "#3b82f6",
                  },
                },
              },
              className: {
                container: "text-white",
                label: "text-white",
                button: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transition-all duration-200",
                input: "bg-black/20 border-white/10 text-white placeholder:text-white/50 focus:border-blue-500/50 transition-all duration-200",
                anchor: "text-blue-400 hover:text-blue-300 transition-colors",
                divider: "text-white/50",
                message: "text-white",
              },
              style: {
                input: {
                  color: 'white',
                },
              },
            }}
            providers={[]}
          />
        </div>
      </div>

      {/* Additional animated elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-4 left-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute top-4 right-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl animate-pulse"></div>
      </div>
    </div>
  );
};

export default Auth;