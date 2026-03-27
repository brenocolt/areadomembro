import { SignupForm } from './signup-form';

export default function SignupPage() {
    return (
        <main className="min-h-screen w-full flex items-center justify-center bg-[#001a41] relative overflow-x-hidden overflow-y-auto py-12">
            {/* Background Decor - Abstract Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[120px] fixed" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/40 rounded-full blur-[120px] fixed" />

            <div className="relative z-10 w-full flex justify-center px-4">
                <SignupForm />
            </div>
        </main>
    );
}
