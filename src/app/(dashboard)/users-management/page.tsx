import { UsersHeader } from "./components/users-header"
import { AccountRequests } from "./components/account-requests"
import { UsersList } from "./components/users-list"

export default function UsersManagementPage() {
    return (
        <div className="space-y-6">
            <UsersHeader />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-12 flex flex-col h-full">
                    <AccountRequests />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 items-start">
                <UsersList />
            </div>
        </div>
    )
}
