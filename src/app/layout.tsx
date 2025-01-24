import { DatabaseChatWrapper } from "@/components/DatabaseChatWrapper";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <DatabaseChatWrapper />
      </body>
    </html>
  );
}