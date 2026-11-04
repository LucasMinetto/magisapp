# Intenção: tela de Regras e dados do livro (P1 ampliada)

> Confirmada com o Lucas em 2026-11-04 (entrevista). Issues: P1 e P2.13 no GitHub.

- **Resultado:** uma tela **Regras** no Magistrado com **todas as regras mecânicas** do livro de Ordem Paranormal, extraídas do PDF do Lucas na mesma etapa da P1, que também preenche a biblioteca com ameaças, rituais e itens.
- **Para quem:** o mestre durante a sessão e os jogadores no celular (P2).
- **Sem duplicar:** a tela de Regras guarda só a regra geral (como funciona a Presença Perturbadora, imunidade, conjuração, carga). Cada ameaça, ritual e item vive na biblioteca; o texto da regra liga para a entrada.
- **Consulta:** sumário por capítulo e seção, busca pelo Ctrl+K e a página do livro em cada regra.
- **Jogadores:** veem todas as regras, menos as de ameaças. Na biblioteca, veem rituais e itens, mas não ameaças: uma criatura só chega a eles pelo cartão "Para os jogadores" que o mestre liberar.
- **Extração:** recortar o PDF em duas colunas (a extração simples embaralha as colunas), remover a marca d'água do RPGPedia com o nome e o e-mail do Lucas (um teste garante isso), texto corrido quase automático, fichas e tabelas com revisão. Os dados vão para o git em JSON por capítulo, com a página de origem.
- **Fora do escopo:** ambientação, história, conselhos de como mestrar. Importador para o PDF de outros mestres (só se for vender ou se a parceria com a Jambô mudar o plano).

## Contexto

- O PDF (`Ordem Paranormal RPG.pdf`, 341 páginas) tem camada de texto; não precisa de OCR. Teste feito com `pdftotext -enc UTF-8` em 2026-11-04.
- Uso pessoal por enquanto. O Lucas pretende apresentar o Magistrado à Jambô para buscar parceria. O repositório é privado, então os dados podem ir para o git.
