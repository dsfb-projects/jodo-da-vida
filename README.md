# Jogo da Vida

Dinâmica multiplayer estilo Kahoot para a apresentação final de **Neuroeconomia (FAE)**: cada aluno entra pelo QR code, escolhe apelido e curso, monta o personagem, e a cada decisão escolhe um caminho. Cada escolha mexe nos 3 pilares (acadêmica, pessoal, profissional), mas os pontos só aparecem no fim, para não enviesar as próximas escolhas. No final: onde cada um terminou (gráfico ternário), perfis, comparação por curso e ranking de quem equilibrou melhor.

Roteiro da apresentação: slides (intro + diários) → **jogo** → slides (conclusão).

## Telas

| Endereço | Quem usa | O que é |
|---|---|---|
| `/` | alunos (celular) | apelido e curso, depois o personagem; votar; ver o resultado pessoal no fim |
| `/host?key=CHAVE` | PC da sala (projetor) | lobby com QR, cenário com os caminhos, matriz, resultado e ranking |
| `/admin?key=CHAVE` | nós (celular) | controlar o jogo de longe, modo manual, cursos, remover jogador |
| `/qr` | slide de abertura | QR grande + endereço para colocar no slide |
| `/galeria.html` | dev | todas as opções de avatar |

## Fluxo de uma partida

`lobby → (para cada decisão) história → votação → revelação → … → resultado da turma → ranking → volta ao lobby`

- **Próximo** avança uma etapa. **Voltar** desfaz (voltar da revelação reabre a votação sem apagar votos).
- Na votação aparece o cronômetro e o contador `28/34 responderam · faltam 6`. Ao zerar o tempo a votação fecha sozinha (`encerrarAoZerar`). **+15 s** estende.
- Na revelação os avatares saem da largada e vão pelo caminho que escolheram (de carro, bike, skate, patinete…), sem os nomes, para ninguém ficar exposto. Quem não respondeu fica parado na largada.
- No celular, a revelação mostra só a escolha da pessoa, sem pontos. Os pontos aparecem no resultado final.
- No ranking, **Voltar ao início** leva todo mundo de volta ao lobby (mantém os jogadores, zera os votos). Pede um segundo toque para confirmar.
- **Matriz** mostra a matriz de payoff que estava escondida (só depois da escolha, para não influenciar).
- Atalhos no projetor: `espaço` ou `→` avança, `←` volta, `M` matriz, `A` painel admin, `F` tela cheia, `H` esconde a barra.

### Pontuação

- Todo mundo começa com `pontosIniciais` (10) em cada pilar. Cada opção soma ou subtrai pontos fixos (o `efeito` no JSON).
- **Nota de equilíbrio = o pilar mais baixo** (maximin). Desempate: soma dos pilares, depois quem respondeu mais rápido.
- **Perfil**: se a diferença entre o maior e o menor pilar passar de `limiarEquilibrio`, o perfil é o pilar mais alto; senão, "Equilibrado".
- **Média da turma**: a estrela no gráfico final.

### Modo manual

Se os celulares falharem, no painel admin marque a escolha da turma em cada decisão. Ela substitui a média dos jogadores naquela decisão (a estrela no gráfico final). Funciona até com zero jogadores.

### Conexão

- O celular guarda o id e o perfil. Se a tela bloquear, a página recarregar ou a rede cair, ele volta sozinho para o mesmo jogador, com os votos.
- A tela fica acesa durante o jogo (Wake Lock, precisa de HTTPS, que o Render já dá).
- Se o servidor reiniciar, os celulares se recadastram sozinhos, mas os votos da partida se perdem.

## Editar o conteúdo

Tudo fica em **`content/decisoes.json`**, sem mexer em código:

- `decisoes[]`: `apresentador`, `titulo`, `cenario`, `tema` (`dia`, `noite`, `chuva`, `cidade`) e `opcoes[]` com `texto`, `icone` (emoji) e `efeito` (pontos por pilar). Funciona com 2 a 4 opções e com quantas decisões quiserem.
- `pilares`: nome, ícone e cor de cada pilar. `nomePilares` é a palavra usada nas telas.
- `cursos`: cursos iniciais (dá para adicionar mais ao vivo no admin).
- `perfis`: textos do resultado de cada um.
- `mostrarRanking`: `false` pula o ranking (o fim vai direto do resultado da turma para o lobby).


## Rodar local

```bash
npm install
npm start                 # http://localhost:3000  (host: /host?key=neuro)
npm run bots              # 30 jogadores-robô para testar
npm run bots:drop         # robôs que caem e voltam (teste de reconexão)
```

Sem `ADMIN_KEY` definida, a chave é `neuro`.

## Deploy no Render

1. No Render: **New → Blueprint** e escolha este repositório (ele lê o `render.yaml`). Ou **New → Web Service** com build `npm install --omit=dev` e start `node server/index.js`.
2. Defina a variável **`ADMIN_KEY`** (a chave do host e do admin).
3. O serviço free dorme depois de 15 min sem acesso e leva ~1 min para acordar: **abra o link uns 10 min antes da aula**.

## Estrutura

```
server/index.js        Express + Socket.IO, rotas, QR, broadcast, reconexão
server/game.js         motor do jogo: estados, votos, pontuação, ranking (sem rede)
content/decisoes.json  conteúdo editável
public/play.*          celular
public/host.*          projetor
public/admin.html      painel admin
public/shared/avatar.js    catálogo e desenho SVG dos avatares
public/shared/controls.js  painel admin compartilhado (admin + gaveta do host)
scripts/bots.js        jogadores-robô
docs/CONTRATO.md       eventos do socket
```
