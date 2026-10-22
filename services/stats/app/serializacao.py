def converter_resultado(valor):
    if hasattr(valor, "items"):
        return {
            chave: converter_resultado(conteudo)
            for chave, conteudo in valor.items()
        }

    if isinstance(valor, (list, tuple)):
        return [converter_resultado(item) for item in valor]

    return valor
