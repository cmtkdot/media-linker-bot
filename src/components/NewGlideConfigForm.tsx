import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  app_id: z.string().min(1, "App ID is required"),
  table_id: z.string().min(1, "Table ID is required"),
  table_name: z.string().min(1, "Table name is required"),
  api_token: z.string().min(1, "API token is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface NewGlideConfigFormProps {
  onSuccess: () => void;
}

export function NewGlideConfigForm({ onSuccess }: NewGlideConfigFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('glide_config')
        .insert([{
          ...values,
          active: false,
          supabase_table_name: null
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Glide configuration added successfully",
      });
      
      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Error adding Glide config:', error);
      toast({
        title: "Error",
        description: "Failed to add Glide configuration",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="app_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>App ID</FormLabel>
              <FormControl>
                <Input placeholder="Enter Glide app ID" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="table_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Table ID</FormLabel>
              <FormControl>
                <Input placeholder="Enter Glide table ID" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="table_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Table Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter table name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="api_token"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Token</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter API token" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Adding..." : "Add Configuration"}
        </Button>
      </form>
    </Form>
  );
}