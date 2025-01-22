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
          <span className="font-bold text-xl">Media Manager</span>
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