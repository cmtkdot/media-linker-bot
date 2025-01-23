"use client";

import { useEffect, useState } from "react";
import { Loader2, Database, XCircle, Bot } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { AnimatedList } from "@/components/ui/animated-list";
import {
  ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
  ExpandableChatFooter,
} from "@/components/ui/expandable-chat";

export function DatabaseExpandableChat() {
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
      } catch (err: any) {
        console.error('Error:', err);
        setConnectionStatus('error');
        setError(err.message || "Failed to initialize chat. Please try again later.");
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: err.message || "Failed to connect to the database chat service",
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <AnimatedList>
            <Alert variant="destructive" className="backdrop-blur-lg bg-destructive/10 border-destructive/50">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">{error}</AlertDescription>
            </Alert>
          </AnimatedList>
        </div>
      );
    }

    return (
      <>
        <ExpandableChatHeader className="flex-col text-center justify-center">
          <h1 className="text-xl font-semibold">Database Chat ✨</h1>
          <p className="text-sm text-muted-foreground">
            Ask me anything about your data
          </p>
        </ExpandableChatHeader>

        <ExpandableChatBody>
          {renderConnectionStatus()}
          <div className="relative rounded-lg overflow-hidden bg-muted h-full">
            {connectionStatus === 'success' && iframeUrl && (
              <iframe
                className="w-full h-full border-0"
                src={iframeUrl}
                allow="clipboard-write"
              />
            )}
          </div>
        </ExpandableChatBody>
      </>
    );
  };

  return (
    <ExpandableChat
      size="lg"
      position="bottom-right"
      icon={<Bot className="h-6 w-6" />}
    >
      {renderContent()}
    </ExpandableChat>
  );
}