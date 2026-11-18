# Contrato do socket

Todos os eventos usam ack (`socket.emit(evento, payload, resposta => …)`).

## Servidor → todos

- `meta` → `{ phase, d, finalStep, deadline, serverNow, courses, config }`. Chega na conexão e a cada mudança (o celular usa para listar os cursos antes de entrar).
- `roster` → `[{ id, nick, avatar }]`. Só no lobby, no máximo 1 por segundo: a lista "Na sala agora" do celular.

## Jogador

| Evento | Payload | Resposta |
|---|---|---|
| `player:join` | `{ id?, nick, course, avatar }` | `{ ok, id, state }` ou `{ ok:false, error }` |
| `player:hello` | `{ id, profile }` (reconexão; recria o jogador se o servidor reiniciou) | `{ ok, id, state }`, `{ ok:false, kicked }` ou `{ ok:false, unknown }` |
| `player:vote` | `{ d, opt }` | `{ ok }` ou `{ ok:false, error }` (só o primeiro voto vale) |
| `player:sync` | `{}` | `{ ok, state }` |

Servidor → jogador: `state` (visão pessoal) e `kicked` (`{ reset }` quando o admin zerou tudo).

Visão pessoal (`state`): `phase`, `d`, `finalStep`, `deadline`, `serverNow`, `config`, `me`, `decision` (com `efeito` só na revelação/final), `myVote` e, só no final, `final` (`scores`, `equilibrio`, `total`, `profile`, `rank`, `of`, `classScores`). Os pontos não vão para o celular durante as decisões.

## Host / admin

`host:hello { key }` → `{ ok, state }`. Depois disso o socket recebe `host:state` a cada mudança.

Comandos: `host:next`, `host:prev`, `host:close`, `host:extend { seconds }`, `host:final { step }` (fim: 0 turma, 1 grupos, 2 ranking), `host:matrix { show? }`, `host:manual { d, opt|null }`, `host:course:add { name }`, `host:course:remove { name }`, `host:kick { id }`, `host:reset { players }`.

Visão do host: tudo da visão comum + `players[]` (`id, nick, course, avatar, connected, voted, vote`), `decision`, `allDecisions`, `showMatrix`, `manual`, `counts`, `classScores`, e no final `ranking[]`. Durante a votação o host só sabe **quem** votou, não **no quê**.

## Avatar

`{ c, s, e, m, t, k, g, v, vc }` = cor, formato, olhos, boca, cabeça, cor do acessório, óculos, veículo, cor do veículo (índices dos catálogos em `public/shared/avatar.js`). O servidor limita cada índice ao tamanho do catálogo.
