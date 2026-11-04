# Conceitos do módulo 7, explicados pelo projeto

Guia de estudo em português: o que é MCP, como ele se organiza e como expor dados a um agente sem expor demais.

## 1. O que é MCP, e como difere de function calling

**Function calling** é um recurso do modelo: você descreve funções na sua chamada à API, e o modelo pede para executá-las. As funções vivem dentro da sua aplicação, e cada aplicação precisa reescrever a integração.

**MCP (Model Context Protocol)** é um protocolo entre a aplicação de IA e quem oferece as ferramentas. Um servidor MCP escrito uma vez funciona no Claude Desktop, no Cursor ou no seu próprio agente. É a mesma ideia de uma API HTTP: separa quem oferece de quem consome.

Os dois se complementam. Em `src/lib/agent.ts`, o agente do painel lista as ferramentas por MCP e as entrega ao modelo como function calling. O modelo nem sabe que MCP existe.

## 2. As três peças do servidor

Veja `src/mcp/server.ts`. A diferença principal é **quem decide usar**:

| Peça | Quem decide | Aqui |
| --- | --- | --- |
| **Tool** | o modelo | `search_products`, `get_order`: consultas que ele escolhe fazer |
| **Resource** | a aplicação | a política da loja, que o painel carrega no prompt |
| **Prompt** | o usuário | `order_update_message`: um modelo de tarefa pronto para acionar |

A **descrição da ferramenta é um prompt**. "Use o skuId, não o productId" está lá porque o modelo lê esse texto para decidir o que fazer. Descrição ruim gera chamada errada, mesmo com o código certo.

## 3. Os dois transportes

- **stdio:** o cliente inicia o servidor como processo local e conversa pela entrada e saída padrão. Por isso `src/mcp/stdio.ts` não pode imprimir nada na saída: qualquer `console.log` quebra o protocolo.
- **Streamable HTTP:** um endpoint que muitos clientes acessam pela rede, em `src/app/api/mcp/route.ts`.

O mesmo `createStoreServer` atende os dois. O que muda é a confiança: no stdio, quem roda o processo já tem a máquina; na web, qualquer um pode chamar, então é preciso autenticar.

**Sem estado:** o SDK v2 cria um servidor novo por requisição. Isso combina com a Vercel, onde cada chamada pode cair em uma instância diferente.

## 4. Segurança em camadas

A ordem está em `createMcpEndpoint` (`src/mcp/http.ts`), e cada etapa protege da seguinte:

1. **Host e Origin:** impedem DNS rebinding e chamadas vindas de páginas de outros sites. O SDK não faz isso sozinho.
2. **Token:** comparado por hash, em tempo constante, para o tempo de resposta não revelar nada. No ambiente fica só o hash.
3. **Rate limit:** por token nas chamadas e por IP nas falhas de login, o que atrasa quem tenta adivinhar tokens.
4. **Protocolo:** só depois disso o MCP roda.

### Autorização: o token decide, não o modelo

Este é o ponto mais importante do módulo. **Nunca confie no modelo para aplicar regras de acesso**, porque um texto malicioso pode convencê-lo de qualquer coisa. Por isso:

- **Ferramentas por escopo.** Um token sem `inventory:read` nem recebe `check_inventory`. Para aquele cliente, ela não existe.
- **O filtro vem do token.** Em `list_orders`, o e-mail da Ana vem do token. O campo `customerEmail` nem existe no esquema dela, e, se o modelo o enviar, ele é ignorado.
- **Mesma resposta para "não existe" e "é de outro".** Se fossem diferentes, daria para descobrir quais números de pedido são reais.

### Minimização de dados

`toOrderView` tira CPF, telefone, sobrenome, e-mail e endereço antes de responder. **O que o modelo nunca recebe, ele não consegue vazar**, nem por erro, nem por injeção de prompt. Vale mais do que pedir no prompt para "não revelar dados".

### Injeção de prompt indireta

A nota do pedido `v502106lvtx-01` foi escrita pelo "cliente" e tenta dar ordens ao agente. Esse é o risco clássico do MCP: **todo dado retornado por uma ferramenta pode conter instruções**. O campo se chama `untrustedCustomerNote` para o modelo saber o que é, mas isso só reduz o risco. A proteção real é o limite acima: mesmo obedecendo à nota, o agente da Ana não alcançaria pedidos de outros clientes, e o servidor não tem ferramenta que altere nada.

## 5. A interface de um sistema real

`VtexClient`, em `src/mcp/vtex-types.ts`, separa as ferramentas da origem dos dados. Os dados simulados têm o formato das APIs da VTEX: `commertialOffer` com esse erro de grafia, preço em reais no catálogo e em centavos no OMS. Para uma loja real, bastaria implementar a mesma interface com chamadas HTTP.

Converter centavos em reais é tarefa do servidor. O agente recebe `totalBRL`, sem precisar saber que o OMS usa centavos.

## 6. Avaliar o uso, não só o código

Os testes provam que o servidor aplica as regras. Já `eval/run.ts` verifica outra coisa: se um agente real, lendo as descrições, escolhe as ferramentas certas. Resultado: 12 de 12.

**Leia as respostas, não só a nota.** Um caso aprovado diz "vou encaminhar para a equipe humana", e não existe ferramenta para isso. As regras procuram palavras e ferramentas, então não percebem uma promessa falsa. Regras fixas são baratas e repetíveis, mas só pegam o que você pensou em verificar. O módulo 10 trata de um modelo atuando como juiz para esse tipo de caso.

**A segurança não depende dessa nota.** Se o modelo errar, o token continua limitando o que ele alcança.

## 7. Limites deste projeto, para dizer em entrevista

- **Tokens fixos, não OAuth.** A especificação usa OAuth para clientes de terceiros. Token fixo serve bem para integrações entre sistemas, mas não para um usuário final autorizar um aplicativo.
- **Rate limit em memória, por instância.** Na Vercel, cada instância conta separadamente. Em produção, ficaria no Redis.
- **Só leitura.** Escrever exige confirmação humana e idempotência, e isso fica para o módulo 8.
- **Dados simulados.** Nunca chamou uma conta VTEX de verdade.

## Exercícios

1. **Inspecione.** Rode `npx @modelcontextprotocol/inspector node dist/stdio.js` e chame cada ferramenta à mão.
2. **Piore uma descrição.** Em `check_inventory`, tire "not the productId" e rode `npm run eval`. O caso `two-steps` piora? O que isso diz sobre descrições?
3. **Novo escopo.** Crie `orders:read:own` com acesso ao rastreio, mas sem o valor do pedido. Onde a regra deve ficar: na ferramenta ou em `toOrderView`?
4. **Rate limit real.** Como você mudaria `createRateLimiter` para funcionar com várias instâncias? O que acontece se o Redis cair: bloquear tudo ou liberar tudo?
