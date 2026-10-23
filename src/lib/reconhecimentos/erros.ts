// Erro de validação/regra de negócio com o status HTTP a devolver.
export class ErroDeRequisicao extends Error {
    status: 400 | 404 | 409
    constructor(mensagem: string, status: 400 | 404 | 409 = 400) {
        super(mensagem)
        this.name = 'ErroDeRequisicao'
        this.status = status
    }
}
