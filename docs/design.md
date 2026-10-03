# Thread (antes Cofre de Histórias) — plano e decisões

> A IA nunca substitui a memória original. O artefato principal é a voz.
> A IA é índice e estrutura; a pessoa continua sendo a autora.

## Decisões de UX escolhidas

- Explorar: **linha da vida** (quando aconteceu), com "sem data" separado e pessoas/lugares como índice.
- Processamento: **ao vivo** — a onda se preenche enquanto o texto aparece; histórias e nomes surgem depois.
- Gravação: **um botão + pergunta opcional**, que fica guardada como contexto da gravação.
- Idioma: **interface em inglês**. Gravações, transcrições, títulos, citações, nomes, lugares e todo
  conteúdo extraído permanecem no idioma original da gravação (português na demo). Nada da memória
  é traduzido para combinar com a interface. Textos da interface centralizados (i18n), sem seletor no MVP.
  Conteúdo em outro idioma recebe `lang` próprio no HTML para leitores de tela.

## 1. Estado do repositório

Next.js 16.3 (App Router, Turbopack), React 19.2, Tailwind 4, TypeScript. Nada além do scaffold.
Máquina de referência: MacBook M4, 16 GB, macOS 26.

## 2. Arquitetura mínima

```
navegador (gravar / ouvir / procurar)
   │  MediaRecorder → upload único         ▲ áudio com Range (206)
   ▼                                        │
Next.js (um processo Node, local)
   ├─ route handlers  /api/recordings, /api/search, áudio, status
   ├─ fila em processo (1 job por vez, estado persistido no SQLite)
   │    1. preservar   ffmpeg → original intocado + m4a (reprodução) + wav 16 kHz + picos da onda
   │    2. ouvir       whisper.cpp (whisper-cli) → segmentos + palavras com tempo
   │    3. organizar   Gemma via Ollama → histórias, pessoas, lugares, tempo (JSON Schema)
   │    4. indexar     EmbeddingGemma via Ollama → vetores por "momento" + FTS5
   └─ SQLite (node:sqlite, embutido no Node 22) + arquivos de áudio em data/
```

Tudo roda em `localhost`. Nenhuma API paga, nenhuma chamada a serviço externo em tempo de execução.
Downloads só acontecem uma vez, no setup (pesos dos modelos).

**Arquivos = memória, SQLite = índice.** O áudio original nunca é alterado. Se o banco for apagado,
o índice pode ser reconstruído a partir das gravações. Isso espelha o princípio do produto.

**A gravação é guardada antes de qualquer IA.** Se a transcrição falhar, a gravação existe e toca.
Se o Gemma falhar, a transcrição existe e é pesquisável. Se a indexação falhar, a busca por palavra continua.
Cada etapa pode ser retomada a partir de onde falhou.

## 3. MVP (o ciclo record → preserve → discover → listen)

P0 — sem isso não há produto
- Primeira vez: "De quem são as histórias?" (nome; ano de nascimento opcional).
- Gravar: abrir → tocar → falar → terminar. Upload e preservação automáticos.
- Importar um áudio existente (WhatsApp, gravador do celular) — mesma pipeline.
- Processamento visível e honesto, com retomada por etapa.
- História: áudio + transcrição sincronizada + anotações com proveniência.
- Arquivo: linha da vida + índice de pessoas e lugares.
- Busca semântica + lexical que devolve momentos reais com "ouvir deste ponto".

P1 — se der tempo
- Renomear título (a família assina o rótulo, não o modelo).
- Perguntas para a próxima conversa (Gemma aponta lacunas; busca sem resultado vira pergunta).
- Prompt inicial do Whisper com nomes já conhecidos do arquivo.
- Recuperação de gravação interrompida.
- Modo escuro.

Fora: autenticação, compartilhamento, colaboração, vários narradores, mapa, grafo, chat, resumos.

## 4. Modelo de informação

| tabela | papel |
|---|---|
| `vault` | narrador (nome, ano de nascimento opcional) |
| `recordings` | uma sessão de gravação: data, duração, origem, pergunta usada, etapa, erro, picos da onda, modelos usados |
| `segments` | a transcrição: `idx`, `start`, `end`, `text`, palavras com tempo, confiança do Whisper |
| `stories` | trecho contínuo de uma gravação: `seg_start..seg_end`, `start..end`, título, segmento da citação |
| `entities` | pessoas e lugares canônicos do arquivo inteiro (aliases, relação: "marido", "irmã") |
| `facts` | cada informação estruturada, com proveniência e evidência |
| `chunks` (+ `chunks_fts`) | "momentos" indexados: janelas de segmentos com embedding e texto para FTS5 |

A citação de destaque de cada história **não é texto do modelo**: o Gemma devolve só o índice do segmento,
e a interface mostra o texto que o Whisper ouviu. O modelo escolhe; não escreve.

## 5. Proveniência

Cada linha de `facts` guarda:

```
kind        person | place | time | life_stage
value       valor normalizado ("José", "Fortaleza", "1978")
provenance  said | extracted | inferred
seg         índice do segmento que sustenta a informação
evidence    as palavras exatas encontradas na transcrição ("em setenta e oito")
start, end  instante da evidência no áudio (via tempo das palavras)
note        por que foi inferido (só para inferred)
model       qual modelo produziu a afirmação
```

Classificação **determinística**, feita fora do modelo (`provenance.ts`), igual para qualquer modelo:

1. O Gemma devolve `{ value, mention, segment, explicit }`.
2. O código procura `mention` (normalizado, sem acentos) no segmento citado e nos vizinhos.
3. Não encontrou → pessoa/lugar é descartado; tempo vira `inferred` sem evidência.
4. `explicit: false` → `inferred` (com a evidência que serviu de base, se houver).
5. Encontrou e `value` aparece literalmente no texto → `said`.
6. Encontrou, mas `value` é uma normalização ("setenta e oito" → 1978, "o Zé" → José) → `extracted`.

Não confiamos no rótulo do modelo; verificamos contra a transcrição.

Na interface, seguindo a convenção de catalogação de arquivos e bibliotecas, **informação fornecida
pelo arquivista vai entre colchetes**: `[c. 1956]`. Dito e extraído aparecem sem colchetes, sempre
com as palavras originais e o instante. Nada depende só de cor.

Temas são categorias do arquivo (vocabulário fechado), não afirmações sobre o passado — aparecem
como organização, não como fato.

## 6. Gemma — variante

| modelo | download | papel |
|---|---|---|
| `gemma4:e4b` | 6,6 GB | **padrão**: arquivista. Cabe com folga num laptop de 16 GB junto com o Whisper |
| `gemma4:12b` | 8,0 GB | modo qualidade (opcional, mais lento) |
| `embeddinggemma` (300M) | 0,6 GB | busca semântica, multilíngue, 768 dimensões |

26B/31B não cabem num laptop comum. A família inteira de "compreender e encontrar" é Gemma.

## 7. Gemma local

Ollama (MIT), `localhost:11434`. Saída estruturada com `format: <JSON Schema>` (decodificação
restrita por gramática), `temperature: 0`, `think: false`, `num_ctx` calculado pelo tamanho da transcrição.

Duas passagens, pequenas e focadas (melhor para um modelo de ~4B):
1. **Segmentar** a gravação inteira: `{ first, last, title, quote }` por história, por índice de segmento.
2. **Anotar** cada história: pessoas, lugares, tempo, fase da vida, temas — com `mention`, `segment`, `explicit`.
   Recebe a lista de pessoas/lugares já conhecidos para resolver "o Zé" = "José" entre gravações.

Fronteira: `StoryInterpreter.interpret(input, onProgress)`. Trocar de modelo é configuração;
trocar de família é outra implementação dessa interface. A verificação de proveniência fica fora dela.

Gravações longas: a transcrição é dividida em janelas com sobreposição para a segmentação.

## 8. Whisper

`whisper.cpp` via Homebrew (`whisper-cli`, Metal), modelo `large-v3-turbo-q8_0` (874 MB): melhor
relação qualidade/velocidade para português falado por pessoas mais velhas, com sotaque regional.

- `-l pt`, `-ojf` (JSON com tokens e tempos), `-pp` (progresso), stdout lido ao vivo.
- VAD Silero (`ggml-silero-v6.2.0`): pausas longas são comuns e o Whisper alucina em silêncio
  ("Legendas pela comunidade Amara.org"). Filtro determinístico dessas frases.
- `--prompt` com o nome do narrador e nomes já conhecidos: o índice do Gemma melhora a grafia
  dos nomes nas próximas transcrições.
- Confiança por palavra guardada: trechos incertos aparecem como incertos ("ouça para confirmar").

## 9. Embeddings

EmbeddingGemma via Ollama `/api/embed`, com os prompts de tarefa do modelo:
documento `title: {título} | text: {trecho}`, consulta `task: search result | query: {pergunta}`.

Unidade indexada = **momento**: janela de segmentos consecutivos (~30 s), com sobreposição.
Busca = cosseno (força bruta em memória; milhares de vetores levam milissegundos) + FTS5 (nomes próprios),
fundidos por Reciprocal Rank Fusion, agrupados por história. Nenhum banco vetorial necessário.

Relacionar histórias não usa LLM: pessoas/lugares em comum + similaridade dos embeddings.

## 10. Fluxos

- **Primeira vez**: nome → arquivo vazio que explica o propósito e convida a gravar.
- **Gravar**: botão grande → "Gravando · 02:14" + onda ao vivo → Terminar → "Guardada."
- **Processar**: guardada ✓ → a onda se preenche enquanto o texto aparece → histórias surgem
  sobre a onda → pessoas e lugares → pronta para ser encontrada.
- **História**: título, quando, citação na voz original, player com marcas, transcrição
  com o tempo na margem esquerda e as anotações na margem direita, ao lado das palavras de onde vieram.
- **Explorar**: linha da vida por década/fase; "sem data" separado; pessoas e lugares como índice.
- **Buscar**: "Encontrei três momentos em que Lúcia falou sobre isso." → trechos reais → ouvir daquele ponto.
  Sem resultado: "Ainda não há gravação sobre isso" → gravar essa pergunta na próxima conversa.

## 11. Direção visual

Editorial, contemporânea, silenciosa. Um plano só, sem cards; hierarquia por tipografia, réguas finas e espaço.

- **Newsreader** (serifa com tamanhos ópticos) para a voz: títulos, transcrição, citações.
- **Atkinson Hyperlegible Next** para a interface: desenhada pelo Braille Institute para leitores
  com baixa visão. Escolha deliberada para quem grava. **Atkinson Hyperlegible Mono** para tempos
  e para os dados de arquivo de uma gravação.
- **Cor como significado.** Os tokens de `globals.css` têm nome de papel, não de tom, e cada um é
  definido uma vez como par claro/escuro com `light-dark()`: `canvas`, `surface`, `text`,
  `text-secondary`, `text-muted`, `line`, `line-strong`, `axis` (o eixo do tempo), `wave` (onda
  inativa), `wave-heard` (o que já foi ouvido), `current` (a voz agora), `revealed` (rastro do que já
  foi dito), `unrevealed` (quase ausente), `evidence` (marca-texto das palavras exatas), `focus` e `error`.
- **Claro é papel marfim** (`#f7f3ea`): quente sem virar sépia. O escuro mantém a linguagem (`#141311`).
  As linhas finas têm valor próprio em cada tema: as mesmas opacidades rendiam menos contraste no
  claro (tinta a 20%: 1,5:1 no claro contra 1,7:1 no escuro; o eixo: 1,9:1 contra 2,5:1).
- **O acento é a voz.** Vermelhão no claro (`#b8391a`, 5,2:1) e coral no escuro (`#ff7a52`, 7,2:1),
  só para o que soa agora: palavra dita, nome falado, fio aceso, gravação. Botões são tinta, erros
  têm vermelho próprio, evidência usa marca-texto neutro.
- **A onda é a assinatura.** Na Life, cada história mostra a forma da própria voz. O trecho ouvido
  fica em tinta, como a parte já tocada de um player; o que soa agora fica na cor da voz; o que
  ainda não foi dito quase não aparece.
- **Captura como linha de voz.** Antes de gravar, uma linha pontilhada ("No voice yet") marca onde a
  voz vai ficar, com Record no começo dela. Gravando, a tomada inteira cresce na linha: o que já foi
  dito vira tinta e só os últimos segundos ficam na cor da voz. Salva, a gravação vira a fonte no
  topo e o que vem dela aparece embaixo, no mesmo eixo de tempo: palavras, histórias, índice.
- **Gravação é fonte, história é interpretação.** A gravação mostra a onda inteira com cada história
  como trecho numerado; a história mostra uma régua com o lugar dela na gravação.
- Tema: System / Light / Dark no rodapé, discreto. A escolha fica num cookie e o servidor já entrega
  a página no tema certo, sem script e sem flash.
- Movimento só para tempo, gravação, reprodução e mudança de estado; `prefers-reduced-motion` respeitado.
- Unidades em `rem`, tamanho base do navegador respeitado, alvos ≥ 44 px (gravação ≥ 112 px).

## 12. Riscos técnicos

| risco | mitigação |
|---|---|
| Microfone no celular exige HTTPS (contexto seguro) | localhost no laptop; `next dev --experimental-https` + certificado mkcert para o IP da rede; importação de áudio |
| Alucinação do Whisper em silêncio | VAD + filtro de frases conhecidas |
| JSON inválido / índices errados do Gemma | JSON Schema, referência por índice, validação e reparo determinísticos |
| Memória em 16 GB | etapas sequenciais, um job por vez, E4B como padrão |
| Formatos de áudio (Safari mp4, Chrome webm) e busca no webm do MediaRecorder | ffmpeg → m4a com faststart; Range requests |
| Português oral (pra, a gente, repetições) nos embeddings | busca híbrida com FTS5 |
| Download dos modelos (~8 GB) | script de setup único; documentado |

## 13. O que cortar primeiro sem ferir o essencial

modo escuro → perguntas para a próxima conversa → renomear título → recuperação de gravação
interrompida → página de temas → player global persistente (volta a ser por página).

Intocável: gravar, guardar antes da IA, transcrição com tempo, histórias com proveniência,
busca até o instante exato, reprodução sincronizada.
