import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useNavigate } from "react-router-dom";

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <Link to="/" className="flex items-center space-x-2">
          <div className="relative w-32 h-8">
            {/* Light mode logo */}
            <img
              src="/lovable-uploads/5b54e72a-75ea-42c5-97c5-d202e3e76a15.png"
              alt="Xdelo Logo"
              className="absolute inset-0 w-full h-full object-contain dark:opacity-0"
            />
            {/* Dark mode logo */}
            <img
              src="/lovable-uploads/3ec87b19-c041-4e80-8db8-953c89275ff4.png"
              alt="Xdelo Logo"
              className="absolute inset-0 w-full h-full object-contain opacity-0 dark:opacity-100"
            />
          </div>
        </Link>
        <nav
          className={cn("mx-6 flex items-center space-x-4 lg:space-x-6", className)}
          {...props}
        >
          <Link
            to="/glide-sync"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Glide Sync
          </Link>
          <Link
            to="/glide-connections"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Connections
          </Link>
        </nav>
        <div className="ml-auto flex items-center space-x-4">
          <Button onClick={handleSignOut} variant="outline">
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}