import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { ThemeToggle } from "./ThemeToggle";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-semibold">Media Manager</Link>
            <Link to="/products" className="text-muted-foreground hover:text-foreground transition-colors">
              Products
            </Link>
            <Link to="/glide-sync" className="text-muted-foreground hover:text-foreground transition-colors">
              Glide Sync
            </Link>
            <Link to="/database-chat" className="text-muted-foreground hover:text-foreground transition-colors">
              Database Chat
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button onClick={handleSignOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto py-6 px-4">
        <div className="glass-card rounded-xl p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;