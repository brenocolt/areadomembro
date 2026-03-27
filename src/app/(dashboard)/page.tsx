import {
    WelcomeHeader,
    MetricCards,
    RecentActivity,
    QuickActions,
    PendingFormsWidget
} from "./components/home-widgets";

export default function DashboardPage() {
    return (
        <div className="max-w-7xl mx-auto">
            <WelcomeHeader />
            <MetricCards />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <RecentActivity />
                </div>
                <div>
                    <QuickActions />
                    <PendingFormsWidget />
                </div>
            </div>
        </div>
    )
}
