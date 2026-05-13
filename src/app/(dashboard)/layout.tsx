import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "@/components/theme-toggle"
import { AuthProvider } from "@/components/auth-provider"
import { LogoutButton } from "@/components/logout-button"
import { RouteGuard } from "@/components/route-guard"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SidebarProvider>
                <AppSidebar />
                <main className="flex-1 flex flex-col min-h-screen bg-slate-50/50 dark:bg-[#0B1120] transition-colors duration-300 ease-in-out">
                    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/80 backdrop-blur-md px-4 sticky top-0 z-10 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                        <div className="flex items-center gap-2">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 h-4" />
                            <div className="font-display font-medium text-sm text-muted-foreground hidden md:block">
                                Portal do Membro
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <ModeToggle />
                            <LogoutButton />
                        </div>
                    </header>
                    <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
                        <RouteGuard>
                            {children}
                        </RouteGuard>
                    </div>
                </main>
            </SidebarProvider>
        </AuthProvider>
    )
}

