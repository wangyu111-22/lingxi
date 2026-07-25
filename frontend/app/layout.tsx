import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import SessionGuard from "@/components/SessionGuard";
import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "灵犀 LingXi — 鸿蒙高校创新赛 Agent创新作品",
  description: "灵犀小伴：面向鸿蒙全场景的个人AI陪伴Agent。涵盖视频知识理解、主动智慧决策、自然语音交互、心理树洞陪伴、多端协同。Agent创新赛道参赛作品。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {/* 全局错误抑制 - 防止第三方库 crash 影响页面 */}
        <script src="/face-api.min.js"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var _r = Node.prototype.removeChild;
            Node.prototype.removeChild = function(c){ if(!c||!c.parentNode)return c; try{return _r.call(this,c);}catch(e){return c;} };
            var _ri = Element.prototype.remove;
            Element.prototype.remove = function(){ try{ if(this.parentNode)_ri.call(this); }catch(e){} };
          })();
          window.addEventListener('error',function(e){ if(e.message&&e.message.includes('removeChild')){ e.preventDefault(); return false; } });
        `}} />
        <ThemeProvider>
          <AppShell>
            <SessionGuard>
              {children}
            </SessionGuard>
          </AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
