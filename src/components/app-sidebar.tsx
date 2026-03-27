"use client"

import * as React from "react"
import {
    LayoutDashboard,
    User,
    TrendingUp,
    Wallet,
    AlertTriangle,
    Ticket,
    ClipboardList,
    Target,
    CalendarDays,
    FileQuestion,
    Crown,
    Star,
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarFooter,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useColaborador } from "@/hooks/use-supabase"
import { useSession } from "next-auth/react"

const memberItems = [
    { title: "Início", url: "/", icon: LayoutDashboard },
    { title: "Perfil", url: "/profile", icon: User },
    { title: "Performance", url: "/performance", icon: TrendingUp },
    { title: "NPS Gerente", url: "/nps-gerente", icon: Crown },
    { title: "NPS Projeto", url: "/nps-projeto", icon: Star },
    { title: "Carteira PIPJ", url: "/wallet", icon: Wallet },
    { title: "Meus PDIs", url: "/pdis", icon: Target },
    { title: "Formulários", url: "/formularios", icon: FileQuestion },
    { title: "Minhas Milhas", url: "/milhas", icon: Ticket },
    { title: "Punições", url: "/punishments", icon: AlertTriangle },
]

const managementItems = [
    { title: "Gestão de PDIs", url: "/pdis-management", icon: Target },
    { title: "Gestão de Formulários", url: "/forms-management", icon: FileQuestion },
    { title: "Gestão de Pontos", url: "/points-management", icon: ClipboardList },
    { title: "Gestão de Milhas", url: "/miles-management", icon: Ticket },
    { title: "Gestão de PIPJ", url: "/pipj-management", icon: Wallet },
    { title: "Gestão de Usuários", url: "/users-management", icon: User },
    { title: "Gestão de Ausências", url: "/absences-management", icon: CalendarDays },
]

function NavGroup({ label, items, pathname }: { label: string; items: typeof memberItems; pathname: string }) {
    if (items.length === 0) return null
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={pathname === item.url}
                                tooltip={item.title}
                            >
                                <Link href={item.url}>
                                    <item.icon />
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname()
    const { colaborador } = useColaborador()
    const { data: session } = useSession()
    const userRole = (session?.user as any)?.role

    const user = {
        name: colaborador?.nome || "Carregando...",
        role: colaborador?.cargo_atual || "",
        initials: colaborador?.nome ? colaborador.nome.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : "..."
    }

    // Filter pages based on paginas_permitidas
    // ADMIN role bypasses — sees everything
    // If paginas_permitidas is null/undefined, show all pages (backwards compatible)
    const allowedPages: string[] | null = colaborador?.paginas_permitidas || null
    const isAdmin = userRole === 'ADMIN'

    const filteredMemberItems = isAdmin || !allowedPages
        ? memberItems
        : memberItems.filter(item => allowedPages.includes(item.url))

    const filteredManagementItems = isAdmin || !allowedPages
        ? managementItems
        : managementItems.filter(item => allowedPages.includes(item.url))

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    <span className="font-bold text-lg font-display">P</span>
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold font-display">Produtiva Júnior</span>
                                    <span className="text-xs text-muted-foreground">v2.0 Portal</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavGroup label="Membro" items={filteredMemberItems} pathname={pathname} />
                <NavGroup label="Gestão de Pessoas" items={filteredManagementItems} pathname={pathname} />
            </SidebarContent>

            <SidebarFooter>
                <div className="p-1">
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-sidebar-accent/50 border border-sidebar-border/50 hover:bg-sidebar-accent transition-colors cursor-pointer group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-none">
                        <Avatar className="h-9 w-9 rounded-lg border border-sidebar-border group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                            <AvatarImage src="/placeholder-user.jpg" />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">{user.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-sm truncate group-data-[collapsible=icon]:hidden">
                            <span className="font-semibold text-sidebar-foreground">{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.role}</span>
                        </div>
                    </div>
                </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}

