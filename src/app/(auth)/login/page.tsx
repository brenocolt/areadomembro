import { LoginForm } from './login-form';

export default function LoginPage() {
    return (
        <main className="min-h-screen w-full flex items-center justify-center bg-[#001a41] relative overflow-hidden">
            {/* Background Decor - Abstract Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/40 rounded-full blur-[120px]" />

            <div className="relative z-10 w-full flex justify-center px-4">
                <LoginForm />
            </div>
        </main>
    );
}
