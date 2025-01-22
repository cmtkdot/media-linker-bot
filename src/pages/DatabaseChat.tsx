import { useEffect, useState } from "react";
import { Loader2, Database, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { AnimatedList } from "@/components/ui/animated-list";
import { AuroraBackground } from "@/components/ui/aurora-background";

const DatabaseChat = () => {
  const [iframeUrl, setIframeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const { toast } = useToast();
  const supabase = useSupabaseClient();
  const { session } = useSessionContext();

  useEffect(() => {
    const initializeChatbot = async () => {
      if (!session?.user) {
        setError("Please login to use the database chat");
        setIsLoading(false);
        return;
      }

      try {
        setConnectionStatus('checking');
        
        const { data, error: functionError } = await supabase.functions.invoke('create-ayd-session', {
          body: {
            name: session.user.email,
            email: session.user.email,
          }
        });

        if (functionError) {
          throw functionError;
        }

        if (!data?.url) {
          throw new Error("Invalid chatbot session URL");
        }

        setIframeUrl(data.url);
        setConnectionStatus('success');
        toast({
          title: "Connection Successful",
          description: "Database chat is ready to use",
        });
      } catch (err) {
        console.error('Error:', err);
        setConnectionStatus('error');
        setError("Failed to initialize chat. Please try again later.");
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Failed to connect to the database chat service",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeChatbot();
  }, [toast, supabase, session]);

  const renderConnectionStatus = () => {
    const statusItems = [];

    if (connectionStatus === 'checking') {
      statusItems.push(
        <Alert key="checking" className="mb-4 backdrop-blur-lg bg-background/80 border border-border/50">
          <Database className="h-4 w-4" />
          <AlertDescription className="flex items-center ml-2">
            Initializing database chat...
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          </AlertDescription>
        </Alert>
      );
    } else if (connectionStatus === 'error') {
      statusItems.push(
        <Alert key="error" variant="destructive" className="mb-4 backdrop-blur-lg bg-destructive/10 border-destructive/50">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Failed to connect to database chat. Please try again later.
          </AlertDescription>
        </Alert>
      );
    }

    return statusItems.length > 0 ? (
      <AnimatedList delay={2000}>
        {statusItems}
      </AnimatedList>
    ) : null;
  };

  if (isLoading) {
    return (
      <AuroraBackground>
        <div className="flex items-center justify-center min-h-[600px]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AuroraBackground>
    );
  }

  if (error) {
    return (
      <AuroraBackground>
        <div className="flex items-center justify-center min-h-[600px]">
          <AnimatedList>
            <Alert variant="destructive" className="backdrop-blur-lg bg-destructive/10 border-destructive/50">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">{error}</AlertDescription>
            </Alert>
          </AnimatedList>
        </div>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <div className="container mx-auto p-4">
        <Card className="p-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="text-2xl font-bold mb-4">Database Chat</h1>
          {renderConnectionStatus()}
          <div className="relative rounded-lg overflow-hidden bg-muted">
            {connectionStatus === 'success' && iframeUrl && (
              <iframe
                className="w-full border-0"
                style={{ height: "600px" }}
                src={iframeUrl}
                allow="clipboard-write"
              />
            )}
          </div>
        </Card>
      </div>
    </AuroraBackground>
  );
};

export default DatabaseChat;