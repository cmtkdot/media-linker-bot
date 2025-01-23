import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { ThemeToggle } from "./ThemeToggle";
import { ShootingStars } from "./ui/shooting-stars";
import { AnimatedGridPattern } from "./ui/animated-grid-pattern";

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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background with animated grid pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15)_0%,rgba(0,0,0,0)_80%)]" />
        <AnimatedGridPattern
          numSquares={30}
          maxOpacity={0.1}
          duration={3}
          repeatDelay={1}
          className="[mask-image:radial-gradient(500px_circle_at_center,white,transparent)] inset-x-0 inset-y-[-30%] h-[200%] skew-y-12"
        />
      </div>

      {/* Shooting stars layers */}
      <ShootingStars
        starColor="#9E00FF"
        trailColor="#2EB9DF"
        minSpeed={15}
        maxSpeed={35}
        minDelay={1000}
        maxDelay={3000}
      />
      <ShootingStars
        starColor="#FF0099"
        trailColor="#FFB800"
        minSpeed={10}
        maxSpeed={25}
        minDelay={2000}
        maxDelay={4000}
      />

      {/* Content */}
      <div className="relative z-10">
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
    </div>
  );
};

export default DashboardLayout;