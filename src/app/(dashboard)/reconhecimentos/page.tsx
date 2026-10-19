import { redirect } from "next/navigation"
import { obterAcessoReconhecimentos } from "@/lib/reconhecimentos/guard"
import { ReconhecimentosPage } from "./components/reconhecimentos-page"

// Sem cache: a decisão de acesso é refeita a cada requisição.
export const dynamic = "force-dynamic"

// Barreira no servidor: quem não for VP/ADMIN é redirecionado antes de
// qualquer conteúdo da aba ser enviado ao navegador (o RouteGuard e o menu são
// camadas adicionais, e as rotas /api/reconhecimentos/* validam de novo).
export default async function Page() {
    const acesso = await obterAcessoReconhecimentos()
    if (!acesso.ok) redirect("/")
    return <ReconhecimentosPage />
}
