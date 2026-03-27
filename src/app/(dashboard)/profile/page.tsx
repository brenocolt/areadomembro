"use client"

import { ProfileCard } from "./components/profile-card";
import { InfoSection } from "./components/info-section";
import { HistoryTables, InfoRow } from "./components/history-tables";
import { useColaborador } from "@/hooks/use-supabase";

export default function ProfilePage() {
    const { colaborador, loading } = useColaborador()

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center text-sm text-muted-foreground mb-2">
                <span>Dashboard</span>
                <span className="mx-2">›</span>
                <span className="font-semibold text-primary dark:text-white">Perfil do Colaborador</span>
            </div>

            <h1 className="text-3xl font-display font-bold text-primary dark:text-white mb-6">
                {loading ? <span className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded h-8 w-48 inline-block" /> : colaborador?.nome || 'Carregando...'}
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Sidebar (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    <ProfileCard />
                    <InfoSection />
                </div>

                {/* Main Content (8 cols) */}
                <div className="lg:col-span-8">
                    <InfoRow />

                    <div className="mb-6">
                        <HistoryTables />
                    </div>
                </div>
            </div>
        </div>
    )
}
